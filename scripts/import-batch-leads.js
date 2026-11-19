/**
 * Import batch leads from CSV into Supabase
 * - Normalizes phone numbers (+91...) and emails
 * - Intelligently maps notes/remarks to lead_status (New, No Answer, Call Later, Not Interested, Follow Up)
 * - Inserts remarks into comments table for complete audit trail
 * - Deduplicates against file and database
 * - Sets source to 'WTP'
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizePhone(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return '+91' + digits;
    if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1);
    if (digits.startsWith('91') && digits.length >= 12) return '+' + digits;
    return '+' + digits;
}

function normalizeEmail(value) {
    if (!value) return null;
    const s = String(value).trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

function determineStatus(note) {
    if (!note) return 'New';
    const n = note.toLowerCase().trim();
    
    if (n === 'no answer' || n === 'no incoming call' || n === 'voice mail' || n === 'voicemail' || 
        n === 'call failed' || n === 'blank call' || n === 'call could not be connected' || 
        n === 'half call' || n === 'answered but no response' || n === 'answered no response' || 
        n === 'no response' || n === 'unavailable' || n.includes('facility not available')) {
        return 'No Answer';
    }
    
    if (n.includes('not interested') || n.includes('no interested') || n.includes('not in service') || 
        n.includes('out of service') || n.includes('number banned') || n.includes('dont want') || 
        n.includes("don't want")) {
        return 'Not Interested';
    }
    
    if (n.includes('follow up')) {
        return 'Follow Up';
    }
    
    if (n === 'busy' || n.startsWith('s/off') || n.includes('call at') || n.includes('call after') || 
        n.includes('call tomorrow') || n.includes('hung up') || n.includes('and cut') || 
        n.includes('currently no idea') || n.includes('said no idea') || n.includes('lack of time')) {
        return 'Call Later';
    }
    
    return 'New';
}

async function main() {
    const csvPath = path.resolve(__dirname, '../excel/raw_batch_leads.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found at:', csvPath);
        process.exit(1);
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    console.log(`\n📄 Loaded CSV file with ${lines.length - 1} raw rows.`);

    // 1. Parse rows
    const rawLeads = [];
    let emptyLineCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',');
        let name = parts[0]?.trim();
        const rawPhone = parts[1]?.trim();
        const rawEmail = parts[2]?.trim();
        const country = parts[3]?.trim() || 'India';
        const note = parts.slice(4).join(',').replace(/^"|"$/g, '').trim();

        const phone = normalizePhone(rawPhone);
        const email = normalizeEmail(rawEmail);

        if (!phone && !email) {
            emptyLineCount++;
            continue;
        }

        if (!name) {
            name = phone; // Fallback to formatted phone number for nameless leads
        }

        const status = determineStatus(note);

        rawLeads.push({
            full_name: name,
            phone_number: phone,
            email: email,
            country: country,
            status: status,
            source: 'WTP',
            note: note || null,
        });
    }

    console.log(`✅ Parsed ${rawLeads.length} valid lead candidates (${emptyLineCount} empty rows skipped).`);

    // 2. Deduplicate within input
    const seenPhones = new Set();
    const seenEmails = new Set();
    const dedupedLeads = [];
    let internalDups = 0;

    for (const lead of rawLeads) {
        if (lead.phone_number && seenPhones.has(lead.phone_number)) {
            internalDups++;
            continue;
        }
        if (lead.email && seenEmails.has(lead.email)) {
            internalDups++;
            continue;
        }

        if (lead.phone_number) seenPhones.add(lead.phone_number);
        if (lead.email) seenEmails.add(lead.email);
        dedupedLeads.push(lead);
    }

    console.log(`🧹 Internal deduplication: ${internalDups} duplicate rows removed from input.`);
    console.log(`🔍 Checking ${dedupedLeads.length} leads against existing database...`);

    // 3. Deduplicate against existing Supabase database
    const phonesToCheck = dedupedLeads.map(l => l.phone_number).filter(Boolean);
    const existingPhones = new Set();

    for (let i = 0; i < phonesToCheck.length; i += 500) {
        const chunk = phonesToCheck.slice(i, i + 500);
        const { data, error } = await supabase
            .from('leads')
            .select('phone_number')
            .in('phone_number', chunk);

        if (error) {
            console.error('Error checking existing phones:', error.message);
        } else if (data) {
            data.forEach(r => existingPhones.add(r.phone_number));
        }
    }

    const leadsToInsert = dedupedLeads.filter(l => !l.phone_number || !existingPhones.has(l.phone_number));
    const alreadyInDbCount = dedupedLeads.length - leadsToInsert.length;

    console.log(`📊 Duplicates already present in database: ${alreadyInDbCount}`);
    console.log(`🚀 Ready to insert ${leadsToInsert.length} unique leads into Supabase.`);

    if (leadsToInsert.length === 0) {
        console.log('No new leads to insert. Process finished.');
        return;
    }

    // 4. Batch insert leads into leads table
    const BATCH_SIZE = 100;
    const insertedLeadsWithNotes = [];
    let insertedTotal = 0;

    // Get an admin user id for comments
    const { data: adminUser } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single();
    const commentUserId = adminUser?.user_id;

    for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
        const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
        const leadsPayload = batch.map(l => ({
            full_name: l.full_name,
            phone_number: l.phone_number,
            email: l.email,
            country: l.country,
            status: l.status,
            source: l.source,
        }));

        process.stdout.write(`   Inserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(leadsToInsert.length / BATCH_SIZE)} (${batch.length} rows)...`);
        const { data, error } = await supabase
            .from('leads')
            .insert(leadsPayload)
            .select('id, phone_number');

        if (error) {
            console.log(` FAILED: ${error.message}`);
        } else {
            console.log(` OK (${data.length} inserted)`);
            insertedTotal += data.length;

            // Map returned IDs to notes
            data.forEach((inserted, idx) => {
                const original = batch[idx];
                if (original && original.note) {
                    insertedLeadsWithNotes.push({
                        lead_id: inserted.id,
                        user_id: commentUserId,
                        comment_text: `Initial Call Remark: ${original.note}`,
                    });
                }
            });
        }
    }

    console.log(`\n✅ Successfully inserted ${insertedTotal} leads.`);

    // 5. Insert call remarks into comments table
    if (insertedLeadsWithNotes.length > 0 && commentUserId) {
        console.log(`📝 Inserting ${insertedLeadsWithNotes.length} call remarks into comments table...`);
        for (let i = 0; i < insertedLeadsWithNotes.length; i += BATCH_SIZE) {
            const commentBatch = insertedLeadsWithNotes.slice(i, i + BATCH_SIZE);
            const { error: commentErr } = await supabase
                .from('comments')
                .insert(commentBatch);

            if (commentErr) {
                console.error(`  Comment batch error: ${commentErr.message}`);
            }
        }
        console.log(`✅ Call remarks successfully linked to lead detail pages.`);
    }

    // 6. Summary breakdown
    const finalStatusBreakdown = {};
    leadsToInsert.forEach(l => {
        finalStatusBreakdown[l.status] = (finalStatusBreakdown[l.status] || 0) + 1;
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎉 LEAD IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Input rows processed     : ${rawLeads.length}`);
    console.log(`Duplicates in input file : ${internalDups}`);
    console.log(`Duplicates already in DB : ${alreadyInDbCount}`);
    console.log(`New leads inserted       : ${insertedTotal}`);
    console.log(`Call remarks recorded    : ${insertedLeadsWithNotes.length}`);
    console.log('Status breakdown of imported leads:');
    for (const [st, count] of Object.entries(finalStatusBreakdown)) {
        console.log(`  - ${st.padEnd(16)}: ${count}`);
    }
    console.log('='.repeat(60) + '\n');
}

main().catch(err => {
    console.error('Fatal error during import:', err);
    process.exit(1);
});

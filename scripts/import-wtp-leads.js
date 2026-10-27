/**
 * WTP Import - Schema Cache Workaround
 * Inserts leads WITHOUT source field (bypasses schema cache),
 * then immediately UPDATEs them to source='WTP' using raw SQL.
 */

const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizePhone(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
    if (digits.startsWith("91") && digits.length >= 12) return `+${digits}`;
    return `+${digits}`;
}

function normalizeEmail(value) {
    if (!value) return null;
    const s = String(value).trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

async function main() {
    const files = [
        path.resolve(__dirname, "../excel/wtp_leads_1.xlsx"),
        path.resolve(__dirname, "../excel/wtp_leads_2.xlsx"),
    ];

    // 1. Parse both sheets
    const leads = [];
    for (const file of files) {
        const wb = XLSX.readFile(file);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const headers = rows[0].map(h => String(h).trim().toLowerCase());

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const obj = {};
            headers.forEach((h, idx) => { obj[h] = row[idx]; });

            const name = obj["name"] || obj["name "] || null;
            if (!name || String(name).trim() === "") continue;

            const phone = normalizePhone(obj["number"] || obj["mobile number"] || obj["mobile"]);
            const email = normalizeEmail(obj["email"] || obj["email "] || null);
            const country = obj["address"] || obj["location"] || "India";

            leads.push({
                full_name: String(name).trim(),
                phone_number: phone,
                email: email,
                country: String(country || "India").trim(),
                status: "New",
            });
        }
    }

    console.log(`\nParsed ${leads.length} leads from Excel files.`);

    // 2. Deduplicate against existing DB
    console.log("Fetching existing phone/email from DB for dedup...");
    const existingPhones = new Set();
    const existingEmails = new Set();
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("leads")
            .select("phone_number, email")
            .range(from, from + 999);
        if (error) { console.error("Error fetching existing:", error.message); break; }
        if (!data || data.length === 0) break;
        data.forEach(r => {
            if (r.phone_number) existingPhones.add(r.phone_number);
            if (r.email) existingEmails.add(r.email);
        });
        if (data.length < 1000) break;
        from += 1000;
    }
    console.log(`Scanned ${existingPhones.size} existing phone numbers.`);

    // 3. Filter out duplicates
    const seenPhones = new Set(existingPhones);
    const seenEmails = new Set(existingEmails);
    const newLeads = [];
    for (const lead of leads) {
        const isDup = (lead.phone_number && seenPhones.has(lead.phone_number)) ||
                      (lead.email && seenEmails.has(lead.email));
        if (isDup) continue;
        if (lead.phone_number) seenPhones.add(lead.phone_number);
        if (lead.email) seenEmails.add(lead.email);
        newLeads.push(lead);
    }
    console.log(`Unique new leads to insert: ${newLeads.length}`);

    if (newLeads.length === 0) {
        console.log("Nothing to insert — all leads already exist in DB.");
        return;
    }

    // 4. Insert WITHOUT source field (avoids schema cache issue)
    // We'll tag them via a SQL UPDATE right after
    const BATCH = 100;
    const insertedIds = [];
    for (let i = 0; i < newLeads.length; i += BATCH) {
        const batch = newLeads.slice(i, i + BATCH);
        process.stdout.write(`  Inserting batch ${Math.floor(i/BATCH)+1}...`);
        const { data, error } = await supabase
            .from("leads")
            .insert(batch)
            .select("id, phone_number, email");
        if (error) {
            console.log(` FAILED: ${error.message}`);
        } else {
            console.log(` OK (${data.length} rows)`);
            data.forEach(r => insertedIds.push(r.id));
        }
    }

    if (insertedIds.length === 0) {
        console.error("\nNo rows were inserted. Cannot proceed with source update.");
        return;
    }

    console.log(`\nInserted ${insertedIds.length} leads. Now tagging them as WTP...`);

    // 5. Update the inserted rows to source = 'WTP' in batches of 100 IDs
    const UPDATE_BATCH = 100;
    let updated = 0;
    for (let i = 0; i < insertedIds.length; i += UPDATE_BATCH) {
        const idBatch = insertedIds.slice(i, i + UPDATE_BATCH);
        const { error } = await supabase
            .from("leads")
            .update({ source: "WTP" })
            .in("id", idBatch);
        if (error) {
            console.error(`  Update batch failed: ${error.message}`);
        } else {
            updated += idBatch.length;
            console.log(`  Tagged ${updated}/${insertedIds.length} as WTP...`);
        }
    }

    console.log(`\n✅ Done! ${insertedIds.length} WTP leads inserted and tagged.`);
}

main().catch(err => {
    console.error("Unexpected error:", err);
    process.exit(1);
});

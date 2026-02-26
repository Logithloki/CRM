/**
 * =============================================
 * Excel → Supabase Lead Importer
 * =============================================
 *
 * Usage:
 *   node scripts/import-leads.js ./path/to/leads.xlsx
 *
 * Or via npm script:
 *   npm run import-leads -- ./path/to/leads.xlsx
 *
 * The script will:
 *   1. Read the Excel file (first sheet)
 *   2. Map & validate columns to the leads table schema
 *   3. Batch-insert rows into Supabase
 *   4. Print a summary report
 */

const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

// ── Load .env.local ──────────────────────────────────────────
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
        "❌ Missing Supabase credentials.\n" +
        "   Make sure NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY\n" +
        "   or NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local"
    );
    process.exit(1);
}

// ── Valid enums (must match your DB schema) ──────────────────
const VALID_STATUSES = [
    "New",
    "No Answer",
    "Follow Up",
    "Unqualified",
    "Closed",
    "Call Later",
    "Hindi Language",
    "Other Language",
    "Retention",
];

// ── Column name mapping ──────────────────────────────────────
// Maps common Excel header variations → database column names
const COLUMN_MAP = {
    // full_name
    "full_name": "full_name",
    "fullname": "full_name",
    "full name": "full_name",
    "name": "full_name",
    "lead name": "full_name",
    "client name": "full_name",
    "customer name": "full_name",
    "customer": "full_name",

    // email
    "email": "email",
    "email address": "email",
    "e-mail": "email",
    "mail": "email",

    // phone_number
    "phone_number": "phone_number",
    "phonenumber": "phone_number",
    "phone number": "phone_number",
    "phone": "phone_number",
    "mobile": "phone_number",
    "mobile number": "phone_number",
    "contact": "phone_number",
    "contact number": "phone_number",
    "tel": "phone_number",
    "telephone": "phone_number",

    // status
    "status": "status",
    "lead status": "status",

    // language
    "language": "language",
    "lang": "language",

    // country
    "country": "country",
    "location": "country",
    "region": "country",

    // assignee
    "assignee": "assignee",
    "assigned to": "assignee",
    "assigned": "assignee",
    "owner": "assignee",
    "sales rep": "assignee",
    "agent": "assignee",

    // created_at
    "created_at": "created_at",
    "created date": "created_at",
    "created": "created_at",
    "date": "created_at",
    "date created": "created_at",
    "creation date": "created_at",
};

// ── Helpers ──────────────────────────────────────────────────

function normalizeHeader(header) {
    return String(header).trim().toLowerCase();
}

// Parse Excel date (could be serial number or string)
function parseExcelDate(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return null;
    }
    // Excel serial number (number of days since 1900-01-01)
    if (typeof value === "number") {
        const utcDays = Math.floor(value - 25569);
        const utcMs = utcDays * 86400 * 1000;
        return new Date(utcMs).toISOString();
    }

    // Try parsing as date string
    const strVal = String(value).trim();

    // Check for DD/MM/YYYY format explicitly
    // Example: "26/02/2025" or "26/02/2025 20:52"
    const dmYRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
    const match = strVal.match(dmYRegex);

    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
        const year = parseInt(match[3], 10);

        // simple date without time
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
            return d.toISOString();
        }
    }

    // Fallback standard parse
    const d = new Date(strVal);
    if (!isNaN(d.getTime())) {
        return d.toISOString();
    }

    return null;
}

function mapHeaders(rawHeaders) {
    const mapping = {};
    const unmapped = [];

    for (const raw of rawHeaders) {
        const normalized = normalizeHeader(raw);
        if (COLUMN_MAP[normalized]) {
            mapping[raw] = COLUMN_MAP[normalized];
        } else {
            unmapped.push(raw);
        }
    }

    return { mapping, unmapped };
}

function validateAndCleanRow(row, mapping, rowIndex) {
    const lead = {};
    const warnings = [];

    for (const [excelCol, dbCol] of Object.entries(mapping)) {
        let value = row[excelCol];
        if (value === undefined || value === null || String(value).trim() === "") {
            continue;
        }
        value = String(value).trim();

        if (dbCol === "status") {
            const matched = VALID_STATUSES.find(
                (s) => s.toLowerCase() === value.toLowerCase()
            );
            if (matched) {
                lead.status = matched;
            } else {
                warnings.push(
                    `Row ${rowIndex}: Invalid status "${value}" — defaulting to "New". Valid: ${VALID_STATUSES.join(", ")}`
                );
                lead.status = "New";
            }
            continue;
        }

        if (dbCol === "created_at") {
            const rawVal = row[excelCol]; // Use raw value (could be number)
            const parsed = parseExcelDate(rawVal);
            if (parsed) {
                lead.created_at = parsed;
            } else {
                warnings.push(`Row ${rowIndex}: Could not parse date "${value}"`);
            }
            continue;
        }

        if (dbCol === "phone_number") {
            // Strip any whitespaces or non-numeric chars except '+'
            let num = value.replace(/[^\d+]/g, '');

            if (num.startsWith("91")) {
                value = "+" + num;
            } else if (!num.startsWith("+91")) {
                // Remove leading + if it exists but isn't +91, then prepend +91
                value = "+91" + num.replace(/^\+/, "");
            } else {
                value = num; // Already starts with +91
            }
            lead[dbCol] = value;
            continue;
        }

        lead[dbCol] = value;
    }

    return { lead, warnings };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
    const filePath = process.argv[2];

    if (!filePath) {
        console.error(
            "❌ No file path provided.\n\n" +
            "Usage:\n" +
            "  node scripts/import-leads.js ./path/to/leads.xlsx\n" +
            "  npm run import-leads -- ./path/to/leads.xlsx"
        );
        process.exit(1);
    }

    const resolvedPath = path.resolve(filePath);
    console.log(`\n📂 Reading: ${resolvedPath}\n`);

    // Read Excel file
    let workbook;
    try {
        workbook = XLSX.readFile(resolvedPath);
    } catch (err) {
        console.error(`❌ Could not read file: ${err.message}`);
        process.exit(1);
    }

    const sheetName = workbook.SheetNames[0];
    console.log(`📄 Using sheet: "${sheetName}"`);

    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (rawData.length === 0) {
        console.error("❌ The sheet is empty — no rows found.");
        process.exit(1);
    }

    console.log(`📊 Found ${rawData.length} rows\n`);

    // Map headers
    const rawHeaders = Object.keys(rawData[0]);
    const { mapping, unmapped } = mapHeaders(rawHeaders);

    console.log("🔗 Column mapping:");
    for (const [excel, db] of Object.entries(mapping)) {
        console.log(`   "${excel}" → ${db}`);
    }

    if (unmapped.length > 0) {
        console.log(`\n⚠️  Unmapped columns (ignored): ${unmapped.join(", ")}`);
    }

    if (!Object.values(mapping).includes("full_name")) {
        console.error(
            '\n❌ No column could be mapped to "full_name" (required).\n' +
            "   Your Excel headers: " + rawHeaders.join(", ") + "\n" +
            '   Expected one of: "Full Name", "Name", "Customer Name", etc.'
        );
        process.exit(1);
    }

    // Validate & clean rows
    const validLeads = [];
    const skippedRows = [];
    const allWarnings = [];

    for (let i = 0; i < rawData.length; i++) {
        const { lead, warnings } = validateAndCleanRow(rawData[i], mapping, i + 2); // +2 for 1-indexed + header
        allWarnings.push(...warnings);

        if (!lead.full_name) {
            skippedRows.push(i + 2);
            continue;
        }

        // Apply defaults
        if (!lead.status) lead.status = "New";
        if (!lead.country) lead.country = "India";

        validLeads.push(lead);
    }

    // --- DEDUPLICATION LOGIC ---
    // Keep only one record per phone number or email to prevent Excel duplicates
    const uniqueLeads = [];
    const seenPhones = new Set();
    const seenEmails = new Set();
    let duplicatesRemoved = 0;

    for (const lead of validLeads) {
        let isDuplicate = false;

        if (lead.phone_number) {
            if (seenPhones.has(lead.phone_number)) isDuplicate = true;
            seenPhones.add(lead.phone_number);
        }

        if (lead.email) {
            const emailLower = lead.email.toLowerCase();
            if (seenEmails.has(emailLower)) isDuplicate = true;
            seenEmails.add(emailLower);
        }

        if (isDuplicate) {
            duplicatesRemoved++;
        } else {
            uniqueLeads.push(lead);
        }
    }

    if (allWarnings.length > 0) {
        console.log("\n⚠️  Warnings:");
        allWarnings.forEach((w) => console.log(`   ${w}`));
    }

    if (skippedRows.length > 0) {
        console.log(
            `\n⏭️  Skipped ${skippedRows.length} rows (missing full_name): rows ${skippedRows.join(", ")}`
        );
    }

    if (duplicatesRemoved > 0) {
        console.log(
            `\n♻️  Removed ${duplicatesRemoved} duplicate rows from the Excel sheet.`
        );
    }

    if (uniqueLeads.length === 0) {
        console.error("\n❌ No valid leads to import.");
        process.exit(1);
    }

    console.log(`\n✅ ${uniqueLeads.length} leads ready to import\n`);

    // Connect to Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Batch insert (100 at a time)
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < uniqueLeads.length; i += BATCH_SIZE) {
        const batch = uniqueLeads.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(uniqueLeads.length / BATCH_SIZE);

        process.stdout.write(
            `   Inserting batch ${batchNum}/${totalBatches} (${batch.length} rows)...`
        );

        const { data, error } = await supabase.from("leads").insert(batch).select();

        if (error) {
            console.log(` ❌ Error: ${error.message}`);
            errorCount += batch.length;
        } else {
            console.log(` ✅`);
            insertedCount += data.length;
        }
    }

    // Summary
    console.log("\n" + "═".repeat(50));
    console.log("📋 IMPORT SUMMARY");
    console.log("═".repeat(50));
    console.log(`   Total rows in Excel : ${rawData.length}`);
    console.log(`   Skipped (invalid)   : ${skippedRows.length}`);
    console.log(`   Duplicates Removed  : ${duplicatesRemoved}`);
    console.log(`   Inserted            : ${insertedCount}`);
    if (errorCount > 0) {
        console.log(`   Failed              : ${errorCount}`);
    }
    console.log("═".repeat(50));
    console.log("");
}

main().catch((err) => {
    console.error("❌ Unexpected error:", err);
    process.exit(1);
});

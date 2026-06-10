/**
 * =============================================
 * Excel → Supabase Lead Importer
 * =============================================
 *
 * Usage:
 *   node scripts/import-leads.js ./excel/leads_1.xlsx ./excel/leads_2.xlsx
 *   node scripts/import-leads.js ./excel
 *
 * Or via npm script:
 *   npm run import-leads -- ./excel
 *
 * The script will:
 *   1. Read one or more spreadsheet files (all sheets in each workbook)
 *   2. Map & validate columns to the leads table schema
 *   3. Deduplicate across all input files
 *   4. Skip rows that already exist in Supabase (phone/email)
 *   5. Batch-insert only unique new leads
 *   6. Print a summary report
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

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
    "Not Interested",
    "Closed",
    "Call Later",
    "Hindi Language",
    "Other Language",
    "Retention",
];

const SUPPORTED_EXTENSIONS = new Set([".xlsx", ".xls", ".xlsm", ".csv"]);

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
    "created at": "created_at",
    "createdat": "created_at",
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

function normalizeEmail(value) {
    if (value === undefined || value === null) return null;

    const normalized = String(value).trim().toLowerCase();
    return normalized || null;
}

function normalizePhone(value) {
    if (value === undefined || value === null) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;

    if (raw.startsWith("+")) {
        return `+${digits}`;
    }

    // Common India default handling while still accepting international values.
    if (digits.length === 10) {
        return `+91${digits}`;
    }
    if (digits.length === 11 && digits.startsWith("0")) {
        return `+91${digits.slice(1)}`;
    }
    if (digits.startsWith("00")) {
        return `+${digits.slice(2)}`;
    }
    if (digits.startsWith("91") && digits.length >= 12) {
        return `+${digits}`;
    }

    return `+${digits}`;
}

function isEmailLike(value) {
    if (value === undefined || value === null) return false;

    const str = String(value).trim();
    if (!str) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isPhoneLike(value) {
    if (value === undefined || value === null) return false;

    const str = String(value).trim();
    if (!str) return false;

    // If letters are present, treat it as non-phone.
    if (/[a-zA-Z]/.test(str)) return false;

    const digits = str.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
}

// Parse Excel date (could be serial number or string)
function parseExcelDate(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return null;
    }
    // Excel serial number (number of days since 1900-01-01)
    if (typeof value === "number") {
        const utcMs = (value - 25569) * 86400 * 1000;
        const d = new Date(utcMs);
        if (!isNaN(d.getTime())) {
            return d.toISOString();
        }
        return null;
    }

    // Try parsing as date string
    const strVal = String(value).trim();

    // Check for DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
    // Examples: "26/02/2025", "26-02-2025", "21.08.2023", "26/02/2025 20:52"
    const dmYRegex = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
    const match = strVal.match(dmYRegex);

    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
        const year = parseInt(match[3], 10);
        const hours = match[4] ? parseInt(match[4], 10) : 0;
        const minutes = match[5] ? parseInt(match[5], 10) : 0;
        const seconds = match[6] ? parseInt(match[6], 10) : 0;

        const d = new Date(year, month, day, hours, minutes, seconds);
        if (
            !isNaN(d.getTime()) &&
            d.getFullYear() === year &&
            d.getMonth() === month &&
            d.getDate() === day
        ) {
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

function validateAndCleanRow(row, mapping, rowIndex, sourceFile) {
    const lead = {};
    const warnings = [];
    const rowRef = `${sourceFile}: row ${rowIndex}`;

    for (const [excelCol, dbCol] of Object.entries(mapping)) {
        const rawValue = row[excelCol];
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
            continue;
        }
        const value = String(rawValue).trim();

        if (dbCol === "status") {
            const matched = VALID_STATUSES.find(
                (s) => s.toLowerCase() === value.toLowerCase()
            );
            if (matched) {
                lead.status = matched;
            } else {
                warnings.push(
                    `${rowRef}: Invalid status "${value}". Defaulting to "New". Valid: ${VALID_STATUSES.join(", ")}`
                );
                lead.status = "New";
            }
            continue;
        }

        if (dbCol === "created_at") {
            const parsed = parseExcelDate(rawValue);
            if (parsed) {
                lead.created_at = parsed;
            } else {
                warnings.push(`${rowRef}: Could not parse date "${value}"`);
            }
            continue;
        }

        if (dbCol === "phone_number") {
            const normalizedPhone = normalizePhone(value);
            if (normalizedPhone) {
                lead.phone_number = normalizedPhone;
            } else if (!lead.email && isEmailLike(value)) {
                lead.email = normalizeEmail(value);
                warnings.push(`${rowRef}: Moved email-like value from phone_number to email`);
            } else {
                warnings.push(`${rowRef}: Could not parse phone "${value}"`);
            }
            continue;
        }

        if (dbCol === "email") {
            const normalizedEmail = normalizeEmail(value);
            if (normalizedEmail) {
                lead.email = normalizedEmail;
            } else if (!lead.phone_number && isPhoneLike(value)) {
                lead.phone_number = normalizePhone(value);
                warnings.push(`${rowRef}: Moved phone-like value from email to phone_number`);
            }
            continue;
        }

        lead[dbCol] = value;
    }

    // Auto-correct common field swaps from messy sheets.
    if (lead.full_name && !lead.phone_number && isPhoneLike(lead.full_name)) {
        const normalizedPhone = normalizePhone(lead.full_name);
        if (normalizedPhone) {
            lead.phone_number = normalizedPhone;
            delete lead.full_name;
            warnings.push(`${rowRef}: Moved phone-like value from full_name to phone_number`);
        }
    }

    if (lead.full_name && !lead.email && isEmailLike(lead.full_name)) {
        const normalizedEmail = normalizeEmail(lead.full_name);
        if (normalizedEmail) {
            lead.email = normalizedEmail;
            delete lead.full_name;
            warnings.push(`${rowRef}: Moved email-like value from full_name to email`);
        }
    }

    return { lead, warnings };
}

function isSpreadsheetFile(filePath) {
    return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function collectSpreadsheetFilesFromDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && isSpreadsheetFile(entry.name))
        .map((entry) => path.resolve(dirPath, entry.name))
        .sort((a, b) => a.localeCompare(b));
}

function resolveInputFiles(inputs) {
    const files = [];

    for (const inputPath of inputs) {
        const resolved = path.resolve(inputPath);

        if (!fs.existsSync(resolved)) {
            throw new Error(`Input path does not exist: ${inputPath}`);
        }

        const stats = fs.statSync(resolved);

        if (stats.isDirectory()) {
            const directoryFiles = collectSpreadsheetFilesFromDirectory(resolved);
            files.push(...directoryFiles);
            continue;
        }

        if (!isSpreadsheetFile(resolved)) {
            throw new Error(
                `Unsupported file type: ${inputPath}. Supported extensions: ${Array.from(SUPPORTED_EXTENSIONS).join(", ")}`
            );
        }

        files.push(resolved);
    }

    return [...new Set(files)];
}

function dedupeLeads(leads, seenPhones = new Set(), seenEmails = new Set()) {
    const uniqueLeads = [];
    let duplicatesRemoved = 0;

    for (const lead of leads) {
        const phoneKey = normalizePhone(lead.phone_number);
        const emailKey = normalizeEmail(lead.email);

        let isDuplicate = false;

        if (phoneKey && seenPhones.has(phoneKey)) {
            isDuplicate = true;
        }
        if (emailKey && seenEmails.has(emailKey)) {
            isDuplicate = true;
        }

        if (isDuplicate) {
            duplicatesRemoved++;
            continue;
        }

        if (phoneKey) {
            seenPhones.add(phoneKey);
            lead.phone_number = phoneKey;
        }
        if (emailKey) {
            seenEmails.add(emailKey);
            lead.email = emailKey;
        }

        uniqueLeads.push(lead);
    }

    return { uniqueLeads, duplicatesRemoved, seenPhones, seenEmails };
}

async function fetchExistingLeadIdentitySets(supabase) {
    const seenPhones = new Set();
    const seenEmails = new Set();

    const PAGE_SIZE = 1000;
    let from = 0;
    let totalRows = 0;

    while (true) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
            .from("leads")
            .select("id, phone_number, email")
            .order("id", { ascending: true })
            .range(from, to);

        if (error) {
            throw new Error(`Failed to read existing leads: ${error.message}`);
        }

        if (!data || data.length === 0) {
            break;
        }

        totalRows += data.length;

        for (const row of data) {
            const phoneKey = normalizePhone(row.phone_number);
            const emailKey = normalizeEmail(row.email);

            if (phoneKey) seenPhones.add(phoneKey);
            if (emailKey) seenEmails.add(emailKey);
        }

        if (data.length < PAGE_SIZE) {
            break;
        }

        from += PAGE_SIZE;
    }

    return { seenPhones, seenEmails, totalRows };
}

async function insertLeadsInBatches(supabase, leads) {
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(leads.length / BATCH_SIZE);

        process.stdout.write(
            `   Inserting batch ${batchNum}/${totalBatches} (${batch.length} rows)...`
        );

        const { data, error } = await supabase
            .from("leads")
            .insert(batch)
            .select("id");

        if (error) {
            console.log(` FAILED: ${error.message}`);
            errorCount += batch.length;
        } else {
            console.log(" OK");
            insertedCount += data.length;
        }
    }

    return { insertedCount, errorCount };
}

function printListWithLimit(items, title, limit = 20) {
    if (items.length === 0) return;

    console.log(`\n${title}`);
    const slice = items.slice(0, limit);
    for (const item of slice) {
        console.log(`   - ${item}`);
    }
    if (items.length > limit) {
        console.log(`   ... and ${items.length - limit} more`);
    }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
    const inputPaths = process.argv.slice(2);

    if (inputPaths.length === 0) {
        console.error(
            "No input path provided.\n\n" +
            "Usage:\n" +
            "  node scripts/import-leads.js ./excel/leads_1.xlsx ./excel/leads_2.xlsx\n" +
            "  node scripts/import-leads.js ./excel\n" +
            "  npm run import-leads -- ./excel"
        );
        process.exit(1);
    }

    let inputFiles = [];
    try {
        inputFiles = resolveInputFiles(inputPaths);
    } catch (err) {
        console.error(`Input error: ${err.message}`);
        process.exit(1);
    }

    if (inputFiles.length === 0) {
        console.error(
            `No spreadsheet files found. Supported extensions: ${Array.from(SUPPORTED_EXTENSIONS).join(", ")}`
        );
        process.exit(1);
    }

    console.log("\nFiles to process:");
    inputFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file}`);
    });

    const validLeads = [];
    const skippedRows = [];
    const allWarnings = [];

    let totalRowsRead = 0;
    let defaultedCreatedAtCount = 0;

    for (let fileIndex = 0; fileIndex < inputFiles.length; fileIndex++) {
        const filePath = inputFiles[fileIndex];
        const fileName = path.basename(filePath);

        console.log(`\n[${fileIndex + 1}/${inputFiles.length}] Reading: ${fileName}`);

        let workbook;
        try {
            workbook = XLSX.readFile(filePath);
        } catch (err) {
            allWarnings.push(`${fileName}: Could not read file (${err.message})`);
            continue;
        }

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            allWarnings.push(`${fileName}: No sheets found`);
            continue;
        }

        console.log(`   Sheets found: ${workbook.SheetNames.length}`);

        for (const sheetName of workbook.SheetNames) {
            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            const sourceLabel = `${fileName} [${sheetName}]`;

            console.log(`   -> Sheet: ${sheetName} (Rows: ${rawData.length})`);

            if (rawData.length === 0) {
                allWarnings.push(`${sourceLabel}: Empty sheet skipped`);
                continue;
            }

            totalRowsRead += rawData.length;

            const rawHeaders = Object.keys(rawData[0]);
            const { mapping, unmapped } = mapHeaders(rawHeaders);

            if (!Object.values(mapping).includes("full_name")) {
                allWarnings.push(
                    `${sourceLabel}: Missing required name column (expected Full Name/Name/Customer Name)`
                );
                continue;
            }

            if (unmapped.length > 0) {
                allWarnings.push(`${sourceLabel}: Ignored columns: ${unmapped.join(", ")}`);
            }

            for (let i = 0; i < rawData.length; i++) {
                const rowNumber = i + 2; // +2 for header row + 1-indexing
                const { lead, warnings } = validateAndCleanRow(
                    rawData[i],
                    mapping,
                    rowNumber,
                    sourceLabel
                );

                allWarnings.push(...warnings);

                if (!lead.full_name) {
                    skippedRows.push(`${sourceLabel}: row ${rowNumber}`);
                    continue;
                }

                if (!lead.status) lead.status = "New";
                if (!lead.country) lead.country = "India";
                if (!lead.created_at) {
                    lead.created_at = new Date().toISOString();
                    defaultedCreatedAtCount++;
                }

                validLeads.push(lead);
            }
        }
    }

    if (validLeads.length === 0) {
        printListWithLimit(allWarnings, "Warnings:", 50);
        console.error("\nNo valid leads found to import.");
        process.exit(1);
    }

    const {
        uniqueLeads: dedupedInputLeads,
        duplicatesRemoved: duplicatesAcrossInputFiles,
    } = dedupeLeads(validLeads);

    console.log(`\nDeduped input rows: removed ${duplicatesAcrossInputFiles} duplicate rows across all input files/sheets.`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log("\nChecking existing leads in Supabase...");
    let existingIdentity;
    try {
        existingIdentity = await fetchExistingLeadIdentitySets(supabase);
    } catch (err) {
        console.error(`Failed to check existing leads: ${err.message}`);
        process.exit(1);
    }

    const {
        uniqueLeads: leadsToInsert,
        duplicatesRemoved: duplicatesAlreadyInDatabase,
    } = dedupeLeads(
        dedupedInputLeads,
        existingIdentity.seenPhones,
        existingIdentity.seenEmails
    );

    if (leadsToInsert.length === 0) {
        printListWithLimit(allWarnings, "Warnings:", 50);
        printListWithLimit(skippedRows, "Skipped rows (missing full_name):", 50);

        console.log("\n" + "=".repeat(56));
        console.log("IMPORT SUMMARY");
        console.log("=".repeat(56));
        console.log(`Input files             : ${inputFiles.length}`);
        console.log(`Rows read               : ${totalRowsRead}`);
        console.log(`Valid rows              : ${validLeads.length}`);
        console.log(`Created_at defaulted    : ${defaultedCreatedAtCount}`);
        console.log(`Skipped invalid rows    : ${skippedRows.length}`);
        console.log(`Duplicates in inputs    : ${duplicatesAcrossInputFiles}`);
        console.log(`Already in database     : ${duplicatesAlreadyInDatabase}`);
        console.log("Inserted                : 0");
        console.log("=".repeat(56));
        console.log("\nNo new leads to insert. Everything appears to be duplicate.");
        return;
    }

    console.log(`Existing rows scanned: ${existingIdentity.totalRows}`);
    console.log(`Duplicates already in DB: ${duplicatesAlreadyInDatabase}`);
    console.log(`\nReady to insert ${leadsToInsert.length} unique leads.`);

    const { insertedCount, errorCount } = await insertLeadsInBatches(
        supabase,
        leadsToInsert
    );

    if (allWarnings.length > 0) {
        printListWithLimit(allWarnings, "Warnings:", 50);
    }
    if (skippedRows.length > 0) {
        printListWithLimit(skippedRows, "Skipped rows (missing full_name):", 50);
    }

    console.log("\n" + "=".repeat(56));
    console.log("IMPORT SUMMARY");
    console.log("=".repeat(56));
    console.log(`Input files             : ${inputFiles.length}`);
    console.log(`Rows read               : ${totalRowsRead}`);
    console.log(`Valid rows              : ${validLeads.length}`);
    console.log(`Created_at defaulted    : ${defaultedCreatedAtCount}`);
    console.log(`Skipped invalid rows    : ${skippedRows.length}`);
    console.log(`Duplicates in inputs    : ${duplicatesAcrossInputFiles}`);
    console.log(`Already in database     : ${duplicatesAlreadyInDatabase}`);
    console.log(`Inserted                : ${insertedCount}`);
    if (errorCount > 0) {
        console.log(`Failed                  : ${errorCount}`);
    }
    console.log("=".repeat(56));
    console.log("");
}

main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanAndImport() {
    console.log("Cleaning leads table...");
    const { error } = await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (error) {
        console.error("Error clearing table:", error);
    } else {
        console.log("Leads table cleared.");
    }
}

cleanAndImport();

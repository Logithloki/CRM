import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoin() {
    console.log("Testing comments JOIN user_roles...");
    const { data, error } = await supabase
        .from("comments")
        .select(`
            *,
            author:user_roles!user_id(display_name)
        `)
        .limit(2);

    if (error) {
        console.error("Error defining relation:", error.message);
    } else {
        console.log("Success! Data:");
        console.log(JSON.stringify(data, null, 2));
    }
}

testJoin();

import { createClient } from "./server";
import { UserRole } from "../types";

export async function getCurrentUserRole(): Promise<UserRole | null> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .single();

    if (error || !data) {
        console.error("Failed to fetch user role:", error?.message);
        return null;
    }

    return data as UserRole;
}

export async function getAssignees(): Promise<UserRole[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("display_name");

    if (error) {
        console.error("Failed to fetch assignees:", error.message);
        return [];
    }

    return data as UserRole[];
}

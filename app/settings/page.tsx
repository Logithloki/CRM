import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/lib/types";
import { getCurrentUserRole } from "@/lib/supabase/roles";
import RolesTable from "@/components/RolesTable";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SettingsPage() {
    const userRole = await getCurrentUserRole();
    const isAdmin = userRole?.role === "admin";

    // Only allow admins to view the settings page
    if (!isAdmin) {
        redirect("/leads");
    }

    const supabase = await createClient();

    // Fetch all users
    const { data: users, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Failed to load users:", error.message);
    }

    const roles: UserRole[] = (users as UserRole[]) || [];

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <Link href="/leads" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                    Back to Leads
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage team members and their roles.</p>
                    </div>
                </div>
            </div>

            <RolesTable users={roles} />
        </div>
    );
}

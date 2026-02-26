import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Lead, Comment } from "@/lib/types";
import { getCurrentUserRole, getAssignees } from "@/lib/supabase/roles";
import LeadDetailTabs from "./LeadDetailTabs";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user role + available assignees
    const userRole = await getCurrentUserRole();
    const isAdmin = userRole?.role === "admin";
    const assignees = await getAssignees();

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

    if (leadError || !lead) {
        notFound();
    }

    // Fetch comments without JOIN, since no explicit Foreign Key exists
    const { data: commentsRaw } = await supabase
        .from("comments")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });

    const comments: Comment[] = (commentsRaw || []).map((c: any) => {
        const author = assignees.find((a) => a.user_id === c.user_id);
        return {
            id: c.id,
            lead_id: c.lead_id,
            user_id: c.user_id,
            comment_text: c.comment_text,
            created_at: c.created_at,
            user_email: author?.display_name || "Unknown User",
        };
    });

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Back button */}
            <Link
                href="/leads"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back to Leads
            </Link>

            {/* Header */}
            <div className="card p-6">
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-base">
                        {(lead as Lead).full_name
                            ? (lead as Lead).full_name
                                .split(" ")
                                .map((n: string) => n[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase()
                            : "?"}
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900">
                            {(lead as Lead).full_name}
                        </h1>
                        <p className="text-sm text-gray-500">
                            {(lead as Lead).email || "No email"} · {(lead as Lead).phone_number || "No phone"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs Content */}
            <LeadDetailTabs lead={lead as Lead} initialComments={comments} isAdmin={isAdmin} assignees={assignees} />
        </div>
    );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AssigneeOption, Lead, Comment } from "@/lib/types";
import { getCurrentUserRole, getAssignees } from "@/lib/supabase/roles";
import LeadDetailTabs from "./LeadDetailTabs";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const [userRole, leadResult, commentsResult] = await Promise.all([
        getCurrentUserRole(),
        supabase
            .from("leads")
            .select("*")
            .eq("id", id)
            .single(),
        supabase
            .from("comments")
            .select("id, lead_id, user_id, comment_text, created_at")
            .eq("lead_id", id)
            .order("created_at", { ascending: false }),
    ]);

    const { data: lead, error: leadError } = leadResult;

    if (leadError || !lead) {
        notFound();
    }

    const isAdmin = userRole?.role === "admin";
    const { data: commentsRaw, error: commentsError } = commentsResult;
    if (commentsError) {
        console.error("Failed to fetch comments:", commentsError.message);
    }

    const commentRows = commentsRaw || [];

    let assignees: AssigneeOption[] = [];
    if (isAdmin) {
        const allAssignees = await getAssignees();
        assignees = allAssignees.map((assignee) => ({
            id: assignee.id,
            user_id: assignee.user_id,
            display_name: assignee.display_name,
        }));
    } else {
        const commenterIds = Array.from(
            new Set(
                commentRows
                    .map((comment: any) => comment.user_id)
                    .filter((userId: string | null | undefined) => Boolean(userId))
            )
        );

        if (commenterIds.length > 0) {
            const { data: commentAuthors, error: commentAuthorsError } = await supabase
                .from("user_roles")
                .select("id, user_id, display_name")
                .in("user_id", commenterIds);

            if (commentAuthorsError) {
                console.error("Failed to fetch comment authors:", commentAuthorsError.message);
            } else {
                assignees = (commentAuthors || []) as AssigneeOption[];
            }
        }
    }

    const assigneeNameByUserId = new Map<string, string>();
    for (const assignee of assignees) {
        assigneeNameByUserId.set(assignee.user_id, assignee.display_name);
    }

    const comments: Comment[] = commentRows.map((c: any) => {
        return {
            id: c.id,
            lead_id: c.lead_id,
            user_id: c.user_id,
            comment_text: c.comment_text,
            created_at: c.created_at,
            user_email: assigneeNameByUserId.get(c.user_id) || "Unknown User",
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

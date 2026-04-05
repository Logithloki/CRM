"use client";

import { useState } from "react";
import { AssigneeOption, Lead, Comment } from "@/lib/types";
import LeadInfo from "@/components/LeadInfo";
import CommentSection from "@/components/CommentSection";

const tabs = [
    { id: "information", label: "Information" },
    { id: "comments", label: "Comments" },
];

export default function LeadDetailTabs({
    lead,
    initialComments,
    isAdmin,
    assignees,
}: {
    lead: Lead;
    initialComments: Comment[];
    isAdmin: boolean;
    assignees: AssigneeOption[];
}) {
    const [activeTab, setActiveTab] = useState("information");

    return (
        <div>
            {/* Tab Navigation */}
            <div className="flex gap-0 border-b border-gray-200 mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.id
                            ? "border-gray-900 text-gray-900"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === "information" && <LeadInfo lead={lead} isAdmin={isAdmin} assignees={assignees} />}
                {activeTab === "comments" && (
                    <CommentSection leadId={lead.id} initialComments={initialComments} isAdmin={isAdmin} assignees={assignees} />
                )}
            </div>
        </div>
    );
}

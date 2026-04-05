"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AssigneeOption, Lead, LeadStatus, LEAD_STATUSES, STATUS_COLORS } from "@/lib/types";

function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const readOnlyFields: { label: string; key: keyof Lead; type?: "date" }[] = [
    { label: "Full Name", key: "full_name" },
    { label: "Email", key: "email" },
    { label: "Phone Number", key: "phone_number" },
    { label: "Country", key: "country" },
    { label: "Created", key: "created_at", type: "date" },
    { label: "Last Modified", key: "updated_at", type: "date" },
];

export default function LeadInfo({
    lead: initialLead,
    isAdmin,
    assignees,
}: {
    lead: Lead;
    isAdmin: boolean;
    assignees: AssigneeOption[];
}) {
    const supabase = createClient();
    const [lead, setLead] = useState<Lead>(initialLead);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState("");
    const [copiedField, setCopiedField] = useState<string>("");

    const updateField = async (field: string, value: string) => {
        setSaving(true);
        setSaved("");

        setLead((prev) => ({ ...prev, [field]: value }));

        const { error } = await supabase
            .from("leads")
            .update({ [field]: value })
            .eq("id", lead.id);

        setSaving(false);

        if (error) {
            console.error("Update failed:", error.message);
            setLead(initialLead);
            setSaved("error");
        } else {
            setSaved("success");
            setTimeout(() => setSaved(""), 2000);
        }
    };

    const copyToClipboard = async (value: string, fieldKey: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(fieldKey);
            setTimeout(() => {
                setCopiedField((current) => (current === fieldKey ? "" : current));
            }, 1400);
        } catch (error) {
            console.error("Copy failed:", error);
        }
    };

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-gray-900">
                    Lead Information
                </h3>
                {saving && (
                    <span className="text-xs text-gray-400">Saving...</span>
                )}
                {saved === "success" && (
                    <span className="text-xs text-emerald-600">✓ Saved</span>
                )}
                {saved === "error" && (
                    <span className="text-xs text-red-500">Failed to save</span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {/* Status — always editable */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                    </label>
                    <select
                        value={lead.status}
                        onChange={(e) => updateField("status", e.target.value)}
                        className={`select-field text-sm ${STATUS_COLORS[lead.status]}`}
                        suppressHydrationWarning
                    >
                        {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                {/* Assignee — admin: dropdown, non-admin: read-only */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assignee
                    </label>
                    {isAdmin ? (
                        <select
                            value={lead.assignee || ""}
                            onChange={(e) => updateField("assignee", e.target.value)}
                            className="select-field text-sm"
                            suppressHydrationWarning
                        >
                            <option value="">Unassigned</option>
                            {assignees.map((a) => (
                                <option key={a.id} value={a.display_name}>{a.display_name}</option>
                            ))}
                        </select>
                    ) : (
                        <p className="text-sm text-gray-900">
                            {lead.assignee || "Unassigned"}
                        </p>
                    )}
                </div>

                {/* Read-only fields */}
                {readOnlyFields.map((field) => {
                    const value = lead[field.key];

                    if (field.key === "phone_number") {
                        return (
                            <div key={field.key} className="space-y-1.5">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {field.label}
                                </p>
                                {(value as string | null) ? (
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-gray-900">{value as string}</p>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(value as string, field.key)}
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                            title="Copy phone number"
                                        >
                                            {copiedField === field.key ? "Copied" : "Copy"}
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-900">—</p>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div key={field.key} className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {field.label}
                            </p>
                            <p className="text-sm text-gray-900">
                                {field.type === "date"
                                    ? formatDate(value as string | null)
                                    : (value as string) || "—"}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

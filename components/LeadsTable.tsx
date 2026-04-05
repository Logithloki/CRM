"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Lead, LeadStatus, LEAD_STATUSES, STATUS_COLORS, UserRole } from "@/lib/types";
import { useState, useEffect } from "react";

function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }) + " " + d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function LeadsTable({
    leads: initialLeads,
    isAdmin,
    assignees,
}: {
    leads: Lead[];
    isAdmin: boolean;
    assignees: UserRole[];
}) {
    const supabase = createClient();
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [updating, setUpdating] = useState<string | null>(null);
    const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<string>("");
    const [bulkAssignee, setBulkAssignee] = useState<string>("");
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [copiedPhoneLeadId, setCopiedPhoneLeadId] = useState<string | null>(null);

    // CRITICAL: Next.js Server Components pass down fresh data when the URL changes (like filters/search).
    // This hook forces the editable React local state to refresh when the server data arrives!
    useEffect(() => {
        setLeads(initialLeads);
        setSelectedLeadIds(new Set());
    }, [initialLeads]);

    // REAL-TIME: Listen for background database changes made by other users
    useEffect(() => {
        const channel = supabase
            .channel('realtime_leads')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'leads',
                },
                (payload) => {
                    const updatedLead = payload.new;
                    setLeads((prev) =>
                        prev.map((l) =>
                            l.id === updatedLead.id ? { ...l, ...updatedLead } : l
                        )
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const updateLead = async (id: string, field: string, value: string) => {
        setUpdating(id);

        // Optimistic update
        setLeads((prev) =>
            prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
        );

        const { error } = await supabase
            .from("leads")
            .update({ [field]: value })
            .eq("id", id);

        if (error) {
            console.error("Update failed:", error.message);
            setLeads(initialLeads);
        }

        setUpdating(null);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedLeadIds(new Set(leads.map(l => l.id)));
        } else {
            setSelectedLeadIds(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSet = new Set(selectedLeadIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedLeadIds(newSet);
    };

    const handleRowClick = (leadId: string) => {
        if (!isAdmin) return;
        const newSet = new Set(selectedLeadIds);
        if (newSet.has(leadId)) {
            newSet.delete(leadId);
        } else {
            newSet.add(leadId);
        }
        setSelectedLeadIds(newSet);
    };

    const handleBulkUpdate = async () => {
        if (selectedLeadIds.size === 0) return;
        if (!bulkStatus && !bulkAssignee) return;

        setIsBulkUpdating(true);
        const ids = Array.from(selectedLeadIds);

        // Optimistic update
        setLeads(prev => prev.map(l => {
            if (ids.includes(l.id)) {
                return {
                    ...l,
                    ...(bulkStatus ? { status: bulkStatus as LeadStatus } : {}),
                    ...(bulkAssignee === "Unassigned" ? { assignee: null } : bulkAssignee ? { assignee: bulkAssignee } : {})
                };
            }
            return l;
        }));

        const updatePayload: any = {};
        if (bulkStatus) updatePayload.status = bulkStatus;
        if (bulkAssignee === "Unassigned") updatePayload.assignee = null;
        else if (bulkAssignee) updatePayload.assignee = bulkAssignee;

        const { error } = await supabase
            .from("leads")
            .update(updatePayload)
            .in("id", ids);

        if (error) {
            console.error("Bulk update failed:", error.message);
            setLeads(initialLeads);
        } else {
            setSelectedLeadIds(new Set());
            setBulkStatus("");
            setBulkAssignee("");
        }

        setIsBulkUpdating(false);
    };

    const copyPhoneNumber = async (
        event: React.MouseEvent<HTMLButtonElement>,
        leadId: string,
        phoneNumber: string | null
    ) => {
        event.stopPropagation();
        if (!phoneNumber) return;

        try {
            await navigator.clipboard.writeText(phoneNumber);
            setCopiedPhoneLeadId(leadId);
            setTimeout(() => {
                setCopiedPhoneLeadId((current) => (current === leadId ? null : current));
            }, 1400);
        } catch (error) {
            console.error("Copy failed:", error);
        }
    };

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden relative">
            {isAdmin && selectedLeadIds.size > 0 && (
                <div className="bg-blue-50 border-b border-gray-200 p-3 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-sm font-medium text-blue-800">
                        {selectedLeadIds.size} {selectedLeadIds.size === 1 ? "lead" : "leads"} selected
                    </span>
                    <div className="flex items-center gap-3">
                        <select
                            value={bulkStatus}
                            onChange={(e) => setBulkStatus(e.target.value)}
                            className="select-field text-sm py-1.5 h-auto bg-white"
                        >
                            <option value="">Update Status...</option>
                            {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select
                            value={bulkAssignee}
                            onChange={(e) => setBulkAssignee(e.target.value)}
                            className="select-field text-sm py-1.5 h-auto bg-white"
                        >
                            <option value="">Update Assignee...</option>
                            <option value="Unassigned">Unassigned</option>
                            {assignees.map(a => <option key={a.id} value={a.display_name}>{a.display_name}</option>)}
                        </select>
                        <button
                            onClick={handleBulkUpdate}
                            disabled={isBulkUpdating || (!bulkStatus && !bulkAssignee)}
                            suppressHydrationWarning
                            className="btn-primary py-1.5 px-4 text-sm whitespace-nowrap"
                        >
                            {isBulkUpdating ? "Updating..." : "Apply"}
                        </button>
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {isAdmin && (
                                <th className="px-4 py-3 text-left w-12 text-xs font-semibold text-gray-500">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedLeadIds.size === leads.length && leads.length > 0}
                                        onChange={handleSelectAll}
                                        title="Select All"
                                    />
                                </th>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Phone</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Assignee</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Country</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Modified</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {leads.map((lead) => (
                            <tr
                                key={lead.id}
                                onClick={() => handleRowClick(lead.id)}
                                className={`hover:bg-gray-50 transition-colors ${isAdmin ? "cursor-pointer" : ""} ${updating === lead.id ? "opacity-60" : ""
                                    } ${selectedLeadIds.has(lead.id) ? "bg-blue-50/40 hover:bg-blue-50/60" : ""}`}
                            >
                                {isAdmin && (
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedLeadIds.has(lead.id)}
                                            onChange={(e) => handleSelectRow(lead.id, e.target.checked)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>
                                )}

                                {/* Name — proper <a> link for right-click open in new tab */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <Link
                                        href={`/leads/${lead.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                    >
                                        {lead.full_name}
                                    </Link>
                                </td>

                                {/* Email */}
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap max-w-[200px] truncate">
                                    {lead.email || "—"}
                                </td>

                                {/* Phone */}
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                    {lead.phone_number ? (
                                        <div className="flex items-center gap-2">
                                            <span>{lead.phone_number}</span>
                                            <button
                                                type="button"
                                                onClick={(event) =>
                                                    copyPhoneNumber(event, lead.id, lead.phone_number)
                                                }
                                                suppressHydrationWarning
                                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                title="Copy phone number"
                                            >
                                                {copiedPhoneLeadId === lead.id ? "Copied" : "Copy"}
                                            </button>
                                        </div>
                                    ) : (
                                        "—"
                                    )}
                                </td>

                                {/* Status — always editable dropdown */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <select
                                        value={lead.status}
                                        onChange={(e) =>
                                            updateLead(lead.id, "status", e.target.value)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className={`select-field ${STATUS_COLORS[lead.status]}`}
                                        suppressHydrationWarning
                                    >
                                        {LEAD_STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </td>

                                {/* Assignee — admin: dropdown, non-admin: read-only */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                    {isAdmin ? (
                                        <select
                                            value={lead.assignee || ""}
                                            onChange={(e) =>
                                                updateLead(lead.id, "assignee", e.target.value)
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            className="select-field"
                                            suppressHydrationWarning
                                        >
                                            <option value="">Unassigned</option>
                                            {assignees.map((a) => (
                                                <option key={a.id} value={a.display_name}>
                                                    {a.display_name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="text-sm text-gray-600">
                                            {lead.assignee || "Unassigned"}
                                        </span>
                                    )}
                                </td>

                                {/* Country */}
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                    {lead.country || "—"}
                                </td>

                                {/* Created */}
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                    {formatDate(lead.created_at)}
                                </td>

                                {/* Modified */}
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                    {formatDate(lead.updated_at)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

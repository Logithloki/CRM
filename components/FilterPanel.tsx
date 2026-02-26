"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LEAD_STATUSES, STATUS_COLORS, UserRole } from "@/lib/types";

export default function FilterPanel({ assignees }: { assignees: UserRole[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const activeStatus = searchParams.get("status") || "";
    const activeAssignee = searchParams.get("assignee") || "";
    const hasActiveFilters = Boolean(activeStatus || activeAssignee);

    const [localStatus, setLocalStatus] = useState(activeStatus);
    const [localAssignee, setLocalAssignee] = useState(activeAssignee);

    // Sync local state when opened so it matches active URL
    useEffect(() => {
        if (isOpen) {
            setLocalStatus(searchParams.get("status") || "");
            setLocalAssignee(searchParams.get("assignee") || "");
        }
    }, [isOpen, searchParams]);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const applyFilters = () => {
        const params = new URLSearchParams(searchParams);
        if (localStatus) params.set("status", localStatus);
        else params.delete("status");

        if (localAssignee) params.set("assignee", localAssignee);
        else params.delete("assignee");

        params.set("page", "1");
        router.push(`/leads?${params.toString()}`);
        setIsOpen(false);
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams);
        params.delete("status");
        params.delete("assignee");
        params.set("page", "1");
        router.push(`/leads?${params.toString()}`);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`btn-secondary flex items-center gap-2 ${isOpen ? "bg-gray-100 ring-1 ring-gray-200" : ""
                    }`}
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                </svg>
                <span className="text-sm font-medium">Filters</span>
                {hasActiveFilters && (
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-[320px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-5 transform origin-top-right transition-all">

                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Status Filter */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </label>
                            <select
                                value={localStatus}
                                onChange={(e) => setLocalStatus(e.target.value)}
                                className={`select-field ${localStatus ? STATUS_COLORS[localStatus as keyof typeof STATUS_COLORS] : ""}`}
                                suppressHydrationWarning
                            >
                                <option value="">All Statuses</option>
                                {LEAD_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Assignee Filter */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Assignee
                            </label>
                            <select
                                value={localAssignee}
                                onChange={(e) => setLocalAssignee(e.target.value)}
                                className="select-field"
                                suppressHydrationWarning
                            >
                                <option value="">All Assignees</option>
                                {assignees.map((assignee) => (
                                    <option key={assignee.id} value={assignee.display_name}>
                                        {assignee.display_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Apply & Cancel */}
                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100 mt-2">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="btn-secondary py-1.5 px-3 text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyFilters}
                                className="btn-primary py-1.5 px-3 text-xs"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// TypeScript types for the CRM application
// ============================================

export type LeadStatus =
    | "New"
    | "No Answer"
    | "Follow Up"
    | "Unqualified"
    | "Closed"
    | "Call Later"
    | "Hindi Language"
    | "Other Language"
    | "Retention";

export interface Lead {
    id: string;
    full_name: string;
    email: string | null;
    phone_number: string | null;
    status: LeadStatus;
    language: string | null;
    country: string | null;
    assignee: string | null;
    created_at: string;
    updated_at: string | null;
}

export interface Comment {
    id: string;
    lead_id: string;
    user_id: string;
    comment_text: string;
    created_at: string;
    user_email?: string;
}

export interface LeadsFilterParams {
    status?: LeadStatus;
    assignee?: string;
    search?: string;
    page?: number;
    perPage?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    count: number;
    page: number;
    perPage: number;
    totalPages: number;
}

export const LEAD_STATUSES: LeadStatus[] = [
    "New",
    "No Answer",
    "Follow Up",
    "Unqualified",
    "Closed",
    "Call Later",
    "Hindi Language",
    "Other Language",
    "Retention",
];



export const STATUS_COLORS: Record<LeadStatus, string> = {
    New: "bg-blue-50 text-blue-700 border-blue-200",
    "No Answer": "bg-amber-50 text-amber-700 border-amber-200",
    "Follow Up": "bg-purple-50 text-purple-700 border-purple-200",
    Unqualified: "bg-red-50 text-red-700 border-red-200",
    Closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Call Later": "bg-orange-50 text-orange-700 border-orange-200",
    "Hindi Language": "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Other Language": "bg-teal-50 text-teal-700 border-teal-200",
    Retention: "bg-pink-50 text-pink-700 border-pink-200",
};

// ── DB-Driven Role System ────────────────────────────────────
// Roles are now managed in the 'user_roles' Supabase table.
// - Admin: sees all leads, can change assignees, edit/delete comments.
// - Assignee: sees only their leads, read-only assignee field.

export type RoleType = "admin" | "assignee";

export interface UserRole {
    id: string;
    user_id: string;      // Matches auth.users.id
    email: string;        // Login email
    role: RoleType;       // admin or assignee
    display_name: string; // The name shown in Assignee dropdowns (e.g., "Suriya Kumar")
    created_at: string;
}


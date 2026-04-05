import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Lead, LeadStatus, UserRole } from "@/lib/types";
import { getCurrentUserRole, getAssignees } from "@/lib/supabase/roles";
import LeadsTable from "@/components/LeadsTable";
import FilterPanel from "@/components/FilterPanel";
import SearchBar from "@/components/SearchBar";
import Pagination from "@/components/ui/Pagination";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

const PER_PAGE = 25;

interface PageProps {
    searchParams: Promise<{
        status?: string;
        assignee?: string;
        search?: string;
        page?: string;
    }>;
}

async function fetchLeads(params: {
    status?: string;
    assignee?: string;
    search?: string;
    page?: string;
}, userRole: UserRole | null) {
    const supabase = await createClient();

    const parsedPage = parseInt(params.page || "1", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const from = (page - 1) * PER_PAGE;
    const to = from + PER_PAGE - 1;

    let query = supabase
        .from("leads")
        .select(
            "id, full_name, email, phone_number, status, language, country, assignee, created_at, updated_at",
            { count: "estimated" }
        );

    // Role-based filtering: non-admins only see their assigned leads
    const isAdmin = userRole?.role === "admin";
    if (!isAdmin) {
        if (userRole?.display_name) {
            query = query.eq("assignee", userRole.display_name);
        } else {
            // Unknown user or no role mapping — view nothing
            return { leads: [], count: 0, page, totalPages: 0, isAdmin: false };
        }
    }

    // Apply filters
    if (params.status) {
        query = query.eq("status", params.status as LeadStatus);
    }
    if (params.assignee && isAdmin) {
        query = query.eq("assignee", params.assignee);
    }

    // Apply search
    if (params.search) {
        const searchTerm = `%${params.search}%`;
        query = query.or(
            `full_name.ilike.${searchTerm},email.ilike.${searchTerm},phone_number.ilike.${searchTerm}`
        );
    }

    // Order and paginate
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
        console.error("Error fetching leads:", error);
        return { leads: [], count: 0, page, totalPages: 0, isAdmin };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / PER_PAGE);

    return {
        leads: (data as Lead[]) || [],
        count: totalCount,
        page,
        totalPages,
        isAdmin,
    };
}

async function LeadsContent({
    searchParams,
    leadsPromise,
    assignees,
}: {
    searchParams: {
        status?: string;
        assignee?: string;
        search?: string;
        page?: string;
    };
    leadsPromise: ReturnType<typeof fetchLeads>;
    assignees: UserRole[];
}) {
    const { leads, count, page, totalPages, isAdmin } = await leadsPromise;

    return (
        <>
            {leads.length === 0 ? (
                <EmptyState
                    title="No leads found"
                    description={
                        searchParams.search || searchParams.status || searchParams.assignee
                            ? "Try adjusting your filters or search query."
                            : isAdmin
                                ? "No leads have been added yet."
                                : "No leads have been assigned to you yet."
                    }
                />
            ) : (
                <>
                    <LeadsTable leads={leads} isAdmin={isAdmin} assignees={assignees} />

                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalCount={count}
                        perPage={PER_PAGE}
                    />
                </>
            )}
        </>
    );
}

export default async function LeadsPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams;

    // Get current user role + available assignees
    const userRole = await getCurrentUserRole();
    const isAdmin = userRole?.role === "admin";
    const leadsPromise = fetchLeads(resolvedParams, userRole);
    const assigneesPromise: Promise<UserRole[]> = isAdmin
        ? getAssignees()
        : Promise.resolve([]);
    const assignees = await assigneesPromise;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
            </div>

            {/* Search + Filters */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <Suspense fallback={null}>
                        <SearchBar />
                    </Suspense>
                </div>
                {isAdmin && (
                    <Suspense fallback={null}>
                        <FilterPanel assignees={assignees} />
                    </Suspense>
                )}
            </div>

            {/* Table */}
            <Suspense
                fallback={
                    <div className="flex justify-center py-20">
                        <Spinner size="lg" />
                    </div>
                }
            >
                <LeadsContent
                    searchParams={resolvedParams}
                    leadsPromise={leadsPromise}
                    assignees={assignees}
                />
            </Suspense>
        </div>
    );
}

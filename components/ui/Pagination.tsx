"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

function buildVisiblePages(currentPage: number, totalPages: number): Array<number | "ellipsis-left" | "ellipsis-right"> {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: Array<number | "ellipsis-left" | "ellipsis-right"> = [1];
    const windowStart = Math.max(2, currentPage - 1);
    const windowEnd = Math.min(totalPages - 1, currentPage + 1);

    if (windowStart > 2) {
        pages.push("ellipsis-left");
    }

    for (let page = windowStart; page <= windowEnd; page++) {
        pages.push(page);
    }

    if (windowEnd < totalPages - 1) {
        pages.push("ellipsis-right");
    }

    pages.push(totalPages);
    return pages;
}

export default function Pagination({
    currentPage,
    totalPages,
    totalCount,
    perPage,
}: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    perPage: number;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const visiblePages = buildVisiblePages(currentPage, totalPages);

    const goToPage = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", page.toString());
        startTransition(() => {
            router.push(`/leads?${params.toString()}`);
        });
    };

    const start = (currentPage - 1) * perPage + 1;
    const end = Math.min(currentPage * perPage, totalCount);

    if (totalPages <= 1) return null;

    return (
        <div className={`flex items-center justify-between pt-4 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            <p className="text-sm text-gray-500">
                {start}–{end} of {totalCount}
            </p>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    suppressHydrationWarning
                    className="btn-secondary text-xs disabled:opacity-30"
                >
                    ‹ Prev
                </button>

                {visiblePages.map((pageOrEllipsis) => {
                    if (typeof pageOrEllipsis !== "number") {
                        return (
                            <span key={pageOrEllipsis} className="px-1.5 text-gray-400">
                                …
                            </span>
                        );
                    }

                    return (
                        <button
                            key={pageOrEllipsis}
                            onClick={() => goToPage(pageOrEllipsis)}
                            suppressHydrationWarning
                            className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${pageOrEllipsis === currentPage
                                ? "bg-gray-900 text-white"
                                : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            {pageOrEllipsis}
                        </button>
                    );
                })}

                <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    suppressHydrationWarning
                    className="btn-secondary text-xs disabled:opacity-30"
                >
                    Next ›
                </button>
            </div>
        </div>
    );
}

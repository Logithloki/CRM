"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

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
                    className="btn-secondary text-xs disabled:opacity-30"
                >
                    ‹ Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                    })
                    .map((page, idx, arr) => {
                        const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                        return (
                            <span key={page} className="flex items-center">
                                {showEllipsis && (
                                    <span className="px-1.5 text-gray-400">…</span>
                                )}
                                <button
                                    onClick={() => goToPage(page)}
                                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${page === currentPage
                                        ? "bg-gray-900 text-white"
                                        : "text-gray-600 hover:bg-gray-100"
                                        }`}
                                >
                                    {page}
                                </button>
                            </span>
                        );
                    })}

                <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="btn-secondary text-xs disabled:opacity-30"
                >
                    Next ›
                </button>
            </div>
        </div>
    );
}

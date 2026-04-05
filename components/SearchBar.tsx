"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useTransition } from "react";

export default function SearchBar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [query, setQuery] = useState(searchParams.get("search") || "");

    const updateSearch = useCallback(
        (value: string) => {
            const currentSearch = searchParams.get("search") || "";
            if (value.trim() === currentSearch) return; // Prevent infinite loops or redundant fetches!

            const params = new URLSearchParams(searchParams.toString());
            if (value.trim()) {
                params.set("search", value.trim());
            } else {
                params.delete("search");
            }
            params.delete("page");
            startTransition(() => {
                router.push(`/leads?${params.toString()}`);
            });
        },
        [router, searchParams]
    );

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            updateSearch(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, updateSearch]);

    return (
        <div className={`relative transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
            </div>
            <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                suppressHydrationWarning
                className="input-field pl-10 pr-9"
            />
            {query && (
                <button
                    onClick={() => setQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
}

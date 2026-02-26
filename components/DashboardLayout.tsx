"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { UserRole } from "@/lib/types";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [userRole, setUserRole] = useState<UserRole | null>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from("user_roles")
                    .select("*")
                    .eq("user_id", user.id)
                    .single();
                if (data) setUserRole(data as UserRole);
            }
        };
        getUser();
    }, [supabase.auth]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + "/");

    return (
        <div className="min-h-screen bg-white">
            {/* Top Navbar */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="flex items-center justify-between h-14 px-6">
                    {/* Left: Logo + Nav */}
                    <div className="flex items-center gap-8">
                        <Link href="/leads" className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">IZCRM</span>
                        </Link>
                        <nav className="flex items-center gap-1">
                            <Link
                                href="/leads"
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive("/leads")
                                    ? "bg-gray-100 text-gray-900"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                    }`}
                            >
                                Leads
                            </Link>

                            {/* Admin Only: Settings */}
                            {userRole?.role === "admin" && (
                                <Link
                                    href="/settings"
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive("/settings")
                                        ? "bg-gray-100 text-gray-900"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                        }`}
                                >
                                    Settings
                                </Link>
                            )}
                        </nav>
                    </div>

                    {/* Right: User + Logout */}
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                            {userRole?.display_name || userRole?.email || "Loading..."}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-6 py-6 max-w-[1400px] mx-auto">
                {children}
            </main>
        </div>
    );
}

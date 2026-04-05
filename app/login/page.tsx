"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import loginVisual from "../logooo.jpeg";

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        router.push("/leads");
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-[#f5f4ef] p-4 sm:p-6">
            <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl items-center justify-center sm:min-h-[calc(100vh-3rem)]">
                <div className="grid w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:grid-cols-[1.15fr_1fr]">
                    <div className="relative min-h-[260px] md:min-h-[620px]">
                        <Image
                            src={loginVisual}
                            alt="CRM login visual"
                            fill
                            priority
                            className="object-contain"
                            sizes="(max-width: 768px) 100vw, 58vw"
                        />
                    </div>

                    <div className="p-6 sm:p-8 md:p-10">
                        <div className="mb-8">
                            <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Sign in</h1>
                            <p className="mt-1 text-sm text-gray-600">to access CRM</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            {error && (
                                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    className="input-field"
                                    autoComplete="email"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-field"
                                    autoComplete="current-password"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary w-full py-2.5"
                            >
                                {loading ? "Signing in..." : "Sign in"}
                            </button>
                        </form>

                        <p className="mt-10 text-center text-xs text-gray-500">
                            Contact your administrator for account access
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

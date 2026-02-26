"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserRole, RoleType } from "@/lib/types";

export default function RolesTable({ users: initialUsers }: { users: UserRole[] }) {
    const supabase = createClient();
    const [users, setUsers] = useState<UserRole[]>(initialUsers);
    const [updating, setUpdating] = useState<string | null>(null);

    const updateUser = async (id: string, field: "role" | "display_name", value: string) => {
        setUpdating(id);

        // Optimistic UI updates
        setUsers((prev) =>
            prev.map((u) => (u.id === id ? { ...u, [field]: value } : u))
        );

        const { error } = await supabase
            .from("user_roles")
            .update({ [field]: value })
            .eq("id", id);

        if (error) {
            console.error("Update failed:", error.message);
            // Revert changes on error
            setUsers(initialUsers);
            alert("Failed to update user. " + error.message);
        }

        setUpdating(null);
    };

    return (
        <div className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Display Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Joined</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map((user) => (
                            <tr
                                key={user.id}
                                className={`hover:bg-gray-50 transition-colors ${updating === user.id ? "opacity-60" : ""
                                    }`}
                            >
                                {/* Email (Read-only) */}
                                <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                                    {user.email}
                                </td>

                                {/* Display Name (Editable Text Input) */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <input
                                        type="text"
                                        value={user.display_name}
                                        onChange={(e) => {
                                            const newName = e.target.value;
                                            setUsers((prev) =>
                                                prev.map((u) =>
                                                    u.id === user.id ? { ...u, display_name: newName } : u
                                                )
                                            );
                                        }}
                                        onBlur={(e) => {
                                            const newVal = e.target.value.trim();
                                            const originalUser = initialUsers.find(u => u.id === user.id);

                                            if (newVal && originalUser?.display_name !== newVal) {
                                                updateUser(user.id, "display_name", newVal);
                                            } else if (!newVal && originalUser) {
                                                // Revert if empty
                                                setUsers(prev => prev.map(u =>
                                                    u.id === user.id ? { ...u, display_name: originalUser.display_name } : u
                                                ));
                                            }
                                        }}
                                        className="input-field text-sm h-8 py-1 max-w-[200px]"
                                        placeholder="Display Name"
                                    />
                                </td>

                                {/* Role (Editable Dropdown) */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <select
                                        value={user.role}
                                        onChange={(e) =>
                                            updateUser(user.id, "role", e.target.value as RoleType)
                                        }
                                        className={`select-field text-sm font-medium ${user.role === "admin"
                                            ? "bg-purple-50 text-purple-700 border-purple-200"
                                            : "bg-gray-50 text-gray-700 border-gray-200"
                                            }`}
                                        suppressHydrationWarning
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="assignee">Assignee</option>
                                    </select>
                                </td>

                                {/* Joined Date */}
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                    {new Date(user.created_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric"
                                    })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        No team members found.
                    </div>
                )}
            </div>
        </div>
    );
}

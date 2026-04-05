"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AssigneeOption, Comment } from "@/lib/types";

function formatTimestamp(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function CommentSection({
    leadId,
    initialComments,
    isAdmin,
    assignees,
}: {
    leadId: string;
    initialComments: Comment[];
    isAdmin: boolean;
    assignees: AssigneeOption[];
}) {
    const supabase = createClient();
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const channel = supabase
            .channel(`comments:${leadId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "comments",
                    filter: `lead_id=eq.${leadId}`,
                },
                async (payload) => {
                    const { data } = await supabase
                        .from("comments")
                        .select("*")
                        .eq("id", payload.new.id)
                        .single();

                    if (data) {
                        const rawData = data as any;
                        const author = assignees.find((a) => a.user_id === rawData.user_id);
                        const comment: Comment = {
                            id: rawData.id as string,
                            lead_id: rawData.lead_id as string,
                            user_id: rawData.user_id as string,
                            comment_text: rawData.comment_text as string,
                            created_at: rawData.created_at as string,
                            user_email: author?.display_name || "Unknown User",
                        };
                        setComments((prev) => {
                            if (prev.some((c) => c.id === comment.id)) return prev;
                            return [comment, ...prev];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [leadId, supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setSubmitting(true);
        setError("");

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setError("You must be logged in to comment.");
                setSubmitting(false);
                return;
            }

            const { data, error: insertError } = await supabase
                .from("comments")
                .insert({
                    lead_id: leadId,
                    user_id: user.id,
                    comment_text: newComment.trim(),
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Fetch their actual display name for the optimistic UI
            const { data: userData } = await supabase
                .from("user_roles")
                .select("display_name")
                .eq("user_id", user.id)
                .single();

            const comment: Comment = {
                ...data,
                user_email: userData?.display_name || user.email || "Unknown",
            };
            setComments((prev) => {
                if (prev.some((c) => c.id === comment.id)) return prev;
                return [comment, ...prev];
            });
            setNewComment("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add comment.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditSave = async (commentId: string) => {
        if (!editText.trim()) return;

        // 1. Snapshot previous state for rollback
        const previousComments = [...comments];

        // 2. Optimistic Update (instant UI)
        setComments((prev) =>
            prev.map((c) =>
                c.id === commentId ? { ...c, comment_text: editText.trim() } : c
            )
        );
        setEditingId(null);
        setEditText("");

        // 3. Network Request
        const { error } = await supabase
            .from("comments")
            .update({ comment_text: editText.trim() })
            .eq("id", commentId);

        // 4. Rollback on failure
        if (error) {
            console.error("Failed to update comment:", error);
            setComments(previousComments);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm("Are you sure you want to delete this comment?")) return;

        // 1. Snapshot previous state
        const previousComments = [...comments];

        // 2. Optimistic Update
        setComments((prev) => prev.filter((c) => c.id !== commentId));

        // 3. Network Request
        const { error } = await supabase
            .from("comments")
            .delete()
            .eq("id", commentId);

        // 4. Rollback on failure
        if (error) {
            console.error("Failed to delete comment:", error);
            setComments(previousComments);
        }
    };

    const startEditing = (comment: Comment) => {
        setEditingId(comment.id);
        setEditText(comment.comment_text);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditText("");
    };

    return (
        <div className="card p-6 flex flex-col h-full">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
                Comments
                <span className="text-sm font-normal text-gray-400 ml-2">
                    ({comments.length})
                </span>
            </h3>

            {/* Comment Input */}
            <form onSubmit={handleSubmit} className="mb-6">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    rows={2}
                    className="input-field resize-none"
                />
                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                <div className="flex justify-end mt-2">
                    <button
                        type="submit"
                        disabled={submitting || !newComment.trim()}
                        className="btn-primary text-sm"
                    >
                        {submitting ? "Posting..." : "Post Comment"}
                    </button>
                </div>
            </form>

            {/* Comments List */}
            <div ref={scrollRef} className="space-y-3 flex-1 overflow-y-auto scrollbar-thin">
                {comments.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-sm text-gray-400">No comments yet</p>
                        <p className="text-xs text-gray-400 mt-1">Be the first to comment</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div
                            key={comment.id}
                            className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 group"
                        >
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                        {comment.user_email || "Unknown User"}
                                    </span>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                        {formatTimestamp(comment.created_at)}
                                    </span>
                                </div>

                                {editingId === comment.id ? (
                                    <div className="mt-1">
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="input-field text-sm resize-none"
                                            rows={2}
                                        />
                                        <div className="flex gap-2 mt-1.5">
                                            <button
                                                onClick={() => handleEditSave(comment.id)}
                                                className="btn-primary text-xs px-2.5 py-1"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={cancelEditing}
                                                className="btn-secondary text-xs px-2.5 py-1"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                        {comment.comment_text}
                                    </p>
                                )}
                            </div>

                            {/* Admin: Edit / Delete */}
                            {isAdmin && editingId !== comment.id && (
                                <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEditing(comment)}
                                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                                        title="Edit"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(comment.id)}
                                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        title="Delete"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

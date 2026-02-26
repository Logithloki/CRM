export default function LeadDetailLoading() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Back button skeleton */}
            <div className="h-5 w-28 bg-surface-800 rounded animate-pulse" />

            {/* Header skeleton */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-surface-700 animate-pulse" />
                    <div className="space-y-2">
                        <div className="h-5 w-48 bg-surface-700 rounded animate-pulse" />
                        <div className="h-4 w-64 bg-surface-800 rounded animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Tabs skeleton */}
            <div className="h-12 bg-surface-800/40 rounded-xl animate-pulse" />

            {/* Content skeleton */}
            <div className="glass-card p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-3 w-20 bg-surface-700 rounded animate-pulse" />
                            <div className="h-5 w-40 bg-surface-800 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

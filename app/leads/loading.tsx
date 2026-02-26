export default function Loading() {
    return (
        <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-surface-600 border-t-brand-500 rounded-full animate-spin" />
                <p className="text-sm text-surface-500">Loading leads...</p>
            </div>
        </div>
    );
}

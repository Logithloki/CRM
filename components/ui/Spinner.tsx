export default function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const sizeClasses = {
        sm: "w-4 h-4 border-2",
        md: "w-8 h-8 border-3",
        lg: "w-10 h-10 border-4",
    };

    return (
        <div className="flex items-center justify-center">
            <div
                className={`${sizeClasses[size]} border-gray-200 border-t-gray-900 rounded-full animate-spin`}
            />
        </div>
    );
}

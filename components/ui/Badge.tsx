import { LeadStatus, STATUS_COLORS } from "@/lib/types";

export default function StatusBadge({ status }: { status: LeadStatus }) {
    return (
        <span className={`badge ${STATUS_COLORS[status]}`}>
            {status}
        </span>
    );
}

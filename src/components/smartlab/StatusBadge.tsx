import { Badge } from "@/components/ui/badge";
import type { Candidate } from "@/lib/types";

const statusLabel: Record<Candidate["status"], string> = {
  PENDING: "대기중",
  IN_PROGRESS: "진행중",
  COMPLETED: "평가완료",
  ABSENT: "결시",
};

export function StatusBadge({ status }: { status: Candidate["status"] }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "COMPLETED"
          ? "border-success/40 text-success"
          : status === "IN_PROGRESS"
            ? "border-accent/40 text-accent"
            : status === "ABSENT"
              ? "border-destructive/40 text-destructive"
              : "text-muted-foreground"
      }
    >
      {statusLabel[status]}
    </Badge>
  );
}

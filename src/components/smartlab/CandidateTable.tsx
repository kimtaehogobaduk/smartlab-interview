import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/smartlab/StatusBadge";
import { useStore } from "@/lib/store";
import type { Candidate } from "@/lib/types";

export function CandidateTable({
  roomId,
  compact = false,
}: {
  roomId?: string;
  compact?: boolean;
}) {
  const { state, removeCandidate, setCandidateStatus } = useStore();
  const candidates = state.candidates.filter((candidate) => !roomId || candidate.roomId === roomId);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-secondary/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">지원자</th>
              <th>트랙</th>
              <th>면접 시간</th>
              <th>상태</th>
              <th className="px-4 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{candidate.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {candidate.studentId || candidate.email}
                  </div>
                </td>
                <td>
                  <Badge variant="secondary">{candidate.track}</Badge>
                </td>
                <td className="font-mono text-xs">
                  {candidate.timeslot.start} — {candidate.timeslot.end}
                </td>
                <td>
                  <StatusBadge status={candidate.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {!compact ? (
                    <div className="flex justify-end gap-2">
                      <select
                        aria-label={`${candidate.name} 상태`}
                        value={candidate.status}
                        onChange={(e) =>
                          setCandidateStatus(candidate.id, e.target.value as Candidate["status"])
                        }
                        className="rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="PENDING">대기중</option>
                        <option value="IN_PROGRESS">진행중</option>
                        <option value="COMPLETED">완료</option>
                        <option value="ABSENT">결시</option>
                      </select>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCandidate(candidate.id)}
                      >
                        <X />
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  등록된 지원자가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

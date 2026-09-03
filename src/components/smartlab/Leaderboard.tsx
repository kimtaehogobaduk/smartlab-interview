import { Trophy } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildLeaderboard } from "@/lib/scoring";
import { useStore } from "@/lib/store";

export function Leaderboard({ roomId }: { roomId?: string }) {
  const { state } = useStore();
  const rows = buildLeaderboard(
    state.candidates.filter((c) => !roomId || c.roomId === roomId),
    state.submissions,
    state.criteria,
    state.criteria.formula,
  );
  const [track, setTrack] = useState("전체");
  const tracks = ["전체", ...new Set(rows.map((row) => row.track))];
  const visible = rows.filter((row) => track === "전체" || row.track === track);
  return (
    <Card className="border-border bg-card/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4 text-warning" /> 리더보드
          </CardTitle>
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className="rounded border border-input bg-background px-3 py-2 text-xs"
          >
            {tracks.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visible.map((row) => (
            <div
              key={row.candidateId}
              className="flex items-center gap-4 rounded-lg border border-border p-3"
            >
              <div className="w-8 text-center font-mono text-lg text-muted-foreground">
                #{row.rank}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  {row.name}
                  {row.topCriteria.length ? (
                    <span className="text-[10px] text-warning">TOP {row.topCriteria[0]}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.track} · {row.panelCount}명 제출
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xl font-semibold text-primary">{row.finalScore}</div>
                <div className="text-[10px] text-muted-foreground">등수 산정 점수</div>
              </div>
            </div>
          ))}
          {visible.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              평가 제출 후 순위가 표시됩니다.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

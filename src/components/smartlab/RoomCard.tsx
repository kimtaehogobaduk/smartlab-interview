import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import type { InterviewRoomItem } from "@/lib/types";

export function RoomCard({ room }: { room: InterviewRoomItem }) {
  const { state } = useStore();
  const candidates = state.candidates.filter((c) => c.roomId === room.id);
  const completed = candidates.filter((c) => c.status === "COMPLETED").length;
  return (
    <Card className="group border-border bg-card/60 transition hover:border-primary/50 hover:shadow-[0_0_30px_-18px_var(--primary)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-mono">{room.name}</p>
            <h3 className="mt-2 text-lg font-semibold">{room.title}</h3>
          </div>
          <Badge variant="outline" className="border-success/40 text-success">
            READY
          </Badge>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-xs">
          <div>
            <div className="text-lg font-semibold">{room.interviewers.length}</div>
            <div className="text-muted-foreground">면접관</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{candidates.length}</div>
            <div className="text-muted-foreground">지원자</div>
          </div>
          <div>
            <div className="text-lg font-semibold">
              {room.minutesPerPerson}
              <span className="text-xs">m</span>
            </div>
            <div className="text-muted-foreground">1인 시간</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            평가 진행률 {candidates.length ? Math.round((completed / candidates.length) * 100) : 0}%
          </span>
          <Link
            to="/rooms/$roomId"
            params={{ roomId: room.id }}
            className="flex items-center gap-1 font-medium text-primary"
          >
            입장 <ArrowRight className="size-3 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

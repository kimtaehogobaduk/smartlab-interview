import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Users } from "lucide-react";
import { useState } from "react";
import { AppShell, RoomCard } from "@/components/smartlab-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession, useStore } from "@/lib/store";

export const Route = createFileRoute("/rooms/")({ component: RoomLobbyPage });

function RoomLobbyPage() {
  const { state } = useStore();
  const { interviewer, setInterviewer } = useSession();
  const [selected, setSelected] = useState("");
  const rooms = state.rooms;
  return (
    <AppShell
      eyebrow="Interviewer entry"
      title="면접실 로비"
      description="오늘 배정된 면접실을 선택하고, 심사위원 프로필로 입장하세요. 점수는 다른 면접관에게 공개되지 않습니다."
    >
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="grid gap-4 md:grid-cols-2">
          {rooms.map((room) => (
            <div
              key={room.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected === room.id}
              aria-label={`${room.name} (${room.title}) 선택`}
              onClick={() => setSelected(room.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(room.id);
                }
              }}
              className={`cursor-pointer text-left ${selected === room.id ? "rounded-xl ring-2 ring-primary" : ""}`}
            >
              <RoomCard room={room} />
            </div>
          ))}
        </div>
        {selected ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div>
                  <p className="label-mono">Step 02 / Panel identity</p>
                  <h2 className="mt-2 text-xl font-semibold">본인 프로필을 선택하세요</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    이름만 선택하면 세션에 저장됩니다.
                  </p>
                </div>
                <Users className="size-8 text-primary" />
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {rooms
                  .find((r) => r.id === selected)
                  ?.interviewers.map((person) => (
                    <Button
                      key={person.id}
                      variant={interviewer === person.name ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setInterviewer(person.name)}
                    >
                      {interviewer === person.name ? <KeyRound /> : <Users />}
                      {person.name}
                      <span className="ml-auto text-xs opacity-60">{person.role}</span>
                    </Button>
                  ))}
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <Button asChild disabled={!interviewer}>
                  <Link
                    to="/rooms/$roomId"
                    params={{ roomId: selected }}
                    aria-disabled={!interviewer}
                    tabIndex={!interviewer ? -1 : 0}
                    onClick={(e) => {
                      if (!interviewer) {
                        e.preventDefault();
                      }
                    }}
                  >
                    대기 목록으로 입장 <ArrowRight />
                  </Link>
                </Button>
                {!interviewer ? (
                  <p className="text-xs text-muted-foreground">
                    입장하려면 위에서 본인 프로필을 선택해 주세요.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

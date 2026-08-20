import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Lock, Mic, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SMARTLABINTERVIEW — SmartLab 다대일 면접 선발 플랫폼" },
      {
        name: "description",
        content:
          "평가 기준 거버넌스 잠금, 블라인드 가중 채점, 실시간 STT AI 코파일럿, 가중 절사평균 리더보드를 갖춘 SmartLab 면접 운영 콘솔.",
      },
      { property: "og:title", content: "SMARTLABINTERVIEW" },
      {
        property: "og:description",
        content: "공정한 다대일 면접을 위한 거버넌스 · 블라인드 채점 · AI 코파일럿 플랫폼",
      },
    ],
  }),
  component: LandingEntryPage,
});

const FEATURES = [
  {
    icon: Lock,
    title: "거버넌스 잠금",
    body: "관리자가 항목·가중치를 100%로 확정하기 전에는 어떤 면접관도 채점표를 제출할 수 없습니다.",
  },
  {
    icon: ShieldCheck,
    title: "이중 블라인드",
    body: "면접 중 타 면접관의 점수는 완전히 가려지고, 제출 상태 뱃지만 실시간 공유됩니다.",
  },
  {
    icon: Mic,
    title: "실시간 STT 코파일럿",
    body: "브라우저 음성 인식으로 발화를 기록하고, 3줄 요약·꼬리질문·모순점을 자동 생성합니다.",
  },
  {
    icon: Brain,
    title: "서류 마인드맵",
    body: "지원 서류에서 강점·프로젝트·기술스택·검증 필요 영역을 SVG 그래프로 시각화합니다.",
  },
  {
    icon: Sparkles,
    title: "만능 데이터 파서",
    body: "엑셀 복사 텍스트, 카카오톡 공지, 시간표 캡처 이미지를 무충돌 타임슬롯으로 변환합니다.",
  },
  {
    icon: Trophy,
    title: "절사평균 리더보드",
    body: "최고·최저점을 제외한 가중 절사평균과 과락선 기반 합격 판정을 즉시 계산합니다.",
  },
];

function LandingEntryPage() {
  return (
    <main className="hero-ambient grid-bg min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Brand />
        <span className="label-mono hidden sm:block">v1.0 · Selection Console</span>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16 text-center">
        <span className="label-mono inline-block rounded-full border border-border px-3 py-1">
          Multiple Interviewers → Single Candidate
        </span>
        <h1 className="mt-6 font-mono text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
          SMARTLAB<span className="text-primary">INTERVIEW</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          동아리·학회·부트캠프·연구실의 다대일 면접을 위한 운영 콘솔. 기준 확정 없이는 채점이
          열리지 않고, 편향은 절사평균으로 걷어냅니다.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link to="/rooms" className="group panel block p-7 text-left transition hover:glow-ring">
            <Users className="size-7 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">면접관 모드</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              면접실을 선택하고 본인 프로필로 입장해 실시간 3단 콘솔에서 평가를 진행합니다.
            </p>
            <span className="label-mono mt-5 inline-block text-primary">Interviewer Entry →</span>
          </Link>

          <Link to="/admin" className="group panel block p-7 text-left transition hover:glow-ring">
            <ShieldCheck className="size-7 text-accent" />
            <h2 className="mt-4 text-xl font-semibold">관리자 포털</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              평가 기준·가중치 확정, 면접실 개설, 만능 파서 일괄 등록, 감사 로그를 관리합니다.
            </p>
            <span className="label-mono mt-5 inline-block text-accent">Admin Portal →</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="label-mono mb-5">Core Capabilities</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="panel p-5">
              <feature.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg">
            <Link to="/rooms">면접 시작하기</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

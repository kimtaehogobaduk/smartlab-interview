import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/rooms")({
  head: () => ({
    meta: [
      { title: "면접실 로비 — SMARTLAB INTERVIEW" },
      {
        name: "description",
        content: "배정된 면접실을 선택하고 심사위원 프로필로 입장해 블라인드 평가를 진행하세요.",
      },
      { property: "og:title", content: "면접실 로비 — SMARTLAB INTERVIEW" },
      {
        property: "og:description",
        content: "배정된 면접실을 선택하고 심사위원 프로필로 입장해 블라인드 평가를 진행하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Outlet />,
});

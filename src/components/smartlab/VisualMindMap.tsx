import type { Candidate } from "@/lib/types";

export function VisualMindMap({
  candidateName,
  track,
  nodes,
}: {
  candidateName: string;
  track: string;
  nodes: Candidate["mindMap"];
}) {
  const fallback: Candidate["mindMap"] = [
    { id: "strength", category: "STRENGTH", label: "문제 구조화", evidence: "" },
    { id: "project", category: "PROJECT", label: "대표 프로젝트", evidence: "" },
    { id: "tech", category: "TECH", label: track, evidence: "" },
    { id: "verify", category: "VERIFY", label: "기여 범위 검증", evidence: "" },
  ];
  const source = nodes.length ? nodes : fallback;
  const groups = [
    { key: "STRENGTH" as const, label: "강점", x: 88, y: 62, color: "var(--primary)" },
    { key: "PROJECT" as const, label: "프로젝트", x: 472, y: 62, color: "var(--accent)" },
    { key: "TECH" as const, label: "기술 스택", x: 88, y: 258, color: "var(--chart-4)" },
    { key: "VERIFY" as const, label: "검증 필요", x: 472, y: 258, color: "var(--warning)" },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-secondary/20 p-2">
      <svg
        viewBox="0 0 560 320"
        className="h-auto w-full"
        role="img"
        aria-label="지원자 역량 마인드맵"
      >
        <defs>
          <filter id="mindmap-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {groups.map((group) => (
          <g key={group.key}>
            <line
              x1="280"
              y1="160"
              x2={group.x}
              y2={group.y}
              stroke={group.color}
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            <circle
              cx={group.x}
              cy={group.y}
              r="31"
              fill="var(--card)"
              stroke={group.color}
              strokeWidth="2"
            />
            <text
              x={group.x}
              y={group.y + 4}
              textAnchor="middle"
              fill={group.color}
              fontSize="11"
              fontWeight="600"
            >
              {group.label}
            </text>
            {source
              .filter((node) => node.category === group.key)
              .slice(0, 2)
              .map((node, index) => {
                const offset = index === 0 ? -18 : 18;
                const nodeX = group.x + (group.x < 280 ? 74 : -74);
                const nodeY = group.y + offset;
                return (
                  <g key={node.id}>
                    <line
                      x1={group.x}
                      y1={group.y}
                      x2={nodeX}
                      y2={nodeY}
                      stroke={group.color}
                      strokeOpacity="0.3"
                    />
                    <circle
                      cx={nodeX}
                      cy={nodeY}
                      r="5"
                      fill={group.color}
                      filter="url(#mindmap-glow)"
                    />
                    <text
                      x={nodeX + (nodeX < 280 ? 10 : -10)}
                      y={nodeY + 4}
                      textAnchor={nodeX < 280 ? "start" : "end"}
                      fill="var(--foreground)"
                      fontSize="10"
                    >
                      {node.label.slice(0, 18)}
                    </text>
                  </g>
                );
              })}
          </g>
        ))}
        <circle
          cx="280"
          cy="160"
          r="47"
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth="2"
          filter="url(#mindmap-glow)"
        />
        <text
          x="280"
          y="156"
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize="14"
          fontWeight="700"
        >
          {candidateName.slice(0, 8)}
        </text>
        <text x="280" y="176" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10">
          {track}
        </text>
      </svg>
    </div>
  );
}

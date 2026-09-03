import { Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Gauge;
  accent?: "primary" | "accent" | "warning";
}) {
  return (
    <Card className="border-border bg-card/70">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <span className="label-mono">{label}</span>
          <Icon
            className={`size-4 ${accent === "accent" ? "text-accent" : accent === "warning" ? "text-warning" : "text-primary"}`}
          />
        </div>
        <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
  );
}

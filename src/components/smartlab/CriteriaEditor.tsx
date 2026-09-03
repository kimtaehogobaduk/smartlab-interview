import { Check, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CRITERIA_PRESETS, uid, useStore } from "@/lib/store";
import type { CriteriaConfig, EvaluationCriterion } from "@/lib/types";

export function CriteriaEditor() {
  const { state, setCriteria } = useStore();
  const [draft, setDraft] = useState<CriteriaConfig>(state.criteria);
  const total = draft.items.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const updateItem = (id: string, patch: Partial<EvaluationCriterion>) =>
    setDraft((prev) => ({
      ...prev,
      isConfirmed: false,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  const applyPreset = (preset: (typeof CRITERIA_PRESETS)[number]) =>
    setDraft((prev) => ({
      ...prev,
      isConfirmed: false,
      items: prev.items.map((item, i) => ({
        ...item,
        name: preset.names[i] ?? item.name,
        weight: preset.weights[i] ?? 0,
      })),
    }));
  const addItem = () =>
    setDraft((prev) => ({
      ...prev,
      isConfirmed: false,
      items: [
        ...prev.items,
        {
          id: uid("criterion"),
          name: "새 평가 항목",
          weight: 0,
          description: "이 항목에서 확인할 행동과 근거를 입력하세요.",
          maxScore: 100,
        },
      ],
    }));
  const removeItem = (id: string) =>
    setDraft((prev) => ({
      ...prev,
      isConfirmed: false,
      items: prev.items.length > 1 ? prev.items.filter((item) => item.id !== id) : prev.items,
    }));
  const confirm = () => {
    if (total !== 100) return;
    setCriteria(
      { ...draft, isConfirmed: true, confirmedAt: new Date().toISOString(), confirmedBy: "Admin" },
      "Admin",
      "평가 기준과 가중치 100% 확정",
    );
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {CRITERIA_PRESETS.map((preset) => (
          <Button key={preset.id} size="sm" variant="outline" onClick={() => applyPreset(preset)}>
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3">
        {draft.items.map((item) => (
          <Card key={item.id} className="border-border bg-card/50">
            <CardContent className="grid gap-3 p-4">
              <div className="grid gap-3 md:grid-cols-[1.2fr_100px_100px_auto] md:items-center">
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                  className="font-medium"
                  placeholder="평가 항목명"
                />
                <label className="text-xs text-muted-foreground">
                  가중치 %
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={item.weight}
                    onChange={(e) => updateItem(item.id, { weight: Number(e.target.value) })}
                    className="mt-1"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  만점
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={item.maxScore}
                    onChange={(e) =>
                      updateItem(item.id, { maxScore: Math.max(Number(e.target.value) || 1, 1) })
                    }
                    className="mt-1"
                  />
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeItem(item.id)}
                  disabled={draft.items.length <= 1}
                  aria-label={`${item.name} 삭제`}
                >
                  <Trash2 />
                </Button>
              </div>
              <Textarea
                value={item.description}
                onChange={(e) => updateItem(item.id, { description: e.target.value })}
                placeholder="이 항목에서 확인할 행동, 근거, 평가 기준을 입력하세요."
                className="min-h-16 text-sm"
              />
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(item.weight, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button variant="outline" onClick={addItem}>
        <Plus /> 평가 항목 추가
      </Button>
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 ${total === 100 ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}
      >
        <div>
          <p className="font-semibold">
            가중치 합계{" "}
            <span className={total === 100 ? "text-success" : "text-warning"}>{total}%</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {total === 100
              ? "모든 면접관의 채점표를 열 수 있습니다."
              : `${Math.abs(100 - total)}%를 ${total > 100 ? "줄여" : "추가"}야 합니다.`}
          </p>
        </div>
        <Button disabled={total !== 100} onClick={confirm}>
          {state.criteria.isConfirmed ? <Check /> : <LockKeyhole />}{" "}
          {state.criteria.isConfirmed ? "기준 확정됨" : "기준 확정"}
        </Button>
      </div>
    </div>
  );
}

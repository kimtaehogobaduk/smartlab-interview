import type { Formula } from "@/lib/types";

export function FormulaLabel({ formula }: { formula: Formula }) {
  return (
    <span>
      {formula === "trimmed"
        ? "가중 절사평균"
        : formula === "weighted"
          ? "가중 평균"
          : formula === "median"
            ? "중앙값"
            : "산술평균"}
    </span>
  );
}

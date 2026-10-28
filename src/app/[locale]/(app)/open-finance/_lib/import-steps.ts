import type { ImportStepsProps } from "../_types/types";

export function importSteps({ connected, selected, ready }: ImportStepsProps) {
  const current = !connected ? 0 : !selected ? 1 : !ready ? 2 : 3;
  return ["connect", "source", "mapping", "review"].map((key, index) => ({ key, number: index + 1, done: index < current, current: index === current }));
}

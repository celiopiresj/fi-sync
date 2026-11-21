import { useState } from "react";

// Which card the home "Meus cartões" panel shows, cycling in both
// directions. `upcoming` is the card drawn behind the current one.
export function useCardSelector<T>(cards: T[]) {
  const [index, setIndex] = useState(0);
  const count = cards.length;
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  return {
    index: safeIndex,
    current: cards[safeIndex],
    upcoming: count > 1 ? cards[(safeIndex + 1) % count] : undefined,
    previous: () => setIndex((safeIndex - 1 + count) % count),
    next: () => setIndex((safeIndex + 1) % count),
    select: setIndex,
  };
}

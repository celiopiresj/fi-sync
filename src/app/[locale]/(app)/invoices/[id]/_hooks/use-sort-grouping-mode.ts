"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { InvoiceSortGroupingMode } from "../_types/types";

const STORAGE_KEY = "fi-sync:invoice-sort-grouping-mode";
const DEFAULT_MODE: InvoiceSortGroupingMode = "grouped";

let inMemoryMode: InvoiceSortGroupingMode = DEFAULT_MODE;
const subscribers = new Set<() => void>();

function parseMode(value: string | null): InvoiceSortGroupingMode {
  return value === "flat" ? "flat" : DEFAULT_MODE;
}

function getSnapshot(): InvoiceSortGroupingMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? inMemoryMode : parseMode(stored);
  } catch {
    return inMemoryMode;
  }
}

function getServerSnapshot(): InvoiceSortGroupingMode {
  return DEFAULT_MODE;
}

function subscribe(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange);
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  return () => {
    subscribers.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Persists whether sorting an invoice's transactions table keeps person group
 * headers (`"grouped"`) or flattens rows and reveals the person column
 * (`"flat"`). Uses `useSyncExternalStore` so SSR/hydration match the default
 * `"grouped"` snapshot before reading `localStorage`.
 */
export function useSortGroupingMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback((nextMode: InvoiceSortGroupingMode) => {
    inMemoryMode = nextMode;
    try {
      localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Storage may be blocked in restricted contexts; inMemoryMode preserves the choice for this session.
    }
    for (const listener of subscribers) listener();
  }, []);

  return [mode, setMode] as const;
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "fi-sync:balances-visible";
const EVENT_NAME = "fi-sync:balances-visible-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_NAME, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT_NAME, callback);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function getServerSnapshot(): boolean {
  return true;
}

export function useBalanceVisibility() {
  const balancesVisible = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggleBalancesVisible = useCallback(() => {
    try {
      const next = !getSnapshot();
      window.localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch {
      // Storage unavailable (private mode / restricted quota) — ignore.
    }
  }, []);

  return { balancesVisible, toggleBalancesVisible };
}

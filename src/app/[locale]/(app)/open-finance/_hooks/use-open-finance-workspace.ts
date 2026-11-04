"use client";

import { useEffect, useState } from "react";
import { defaultSourceId, mappedSources, sourceReady } from "../_lib/options";
import { LAST_SOURCE_KEY } from "../_constants/constants";
import type { Overview } from "../_types/types";

function readLastSource() {
  try { return localStorage.getItem(LAST_SOURCE_KEY); } catch { return null; }
}

function writeLastSource(id: string) {
  try { localStorage.setItem(LAST_SOURCE_KEY, id); } catch { /* storage blocked: only a convenience */ }
}

export function useOpenFinanceWorkspace(overview: Overview) {
  const sources = mappedSources(overview);
  const [sourceId, setSourceId] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [storedId, setStoredId] = useState<string | null>(null);
  useEffect(() => {
    // Read after mount: localStorage does not exist during SSR, and reading
    // it in a lazy initializer would mismatch the server-rendered markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStoredId(readLastSource());
  }, []);
  const source = sources.find((source) => source.id === sourceId) ??
    sources.find((source) => source.id === defaultSourceId(sources, overview.accounts, storedId));
  const ready = Boolean(source && sourceReady(source, overview.accounts));
  const editing = Boolean(source && (!ready || settingsId === source.id));
  function select(id: string) { setSourceId(id); setSettingsId(null); writeLastSource(id); }
  function configure(id: string) { setSourceId(id); setSettingsId(id); setManageOpen(false); writeLastSource(id); }
  return {
    sources, source, ready, editing, manageOpen, select, configure,
    // Setup steps only guide the first configuration; once a source is
    // ready to review they would just push the list down.
    setupComplete: ready && !editing,
    edit: () => { if (source) setSettingsId(source.id); },
    complete: () => setSettingsId(null), setManageOpen,
  };
}

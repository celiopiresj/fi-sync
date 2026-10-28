"use client";

import { useState } from "react";
import { mappedSources, sourceReady } from "../_lib/options";
import type { Overview } from "../_types/types";

export function useOpenFinanceWorkspace(overview: Overview) {
  const sources = mappedSources(overview);
  const [sourceId, setSourceId] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(sources.length === 0);
  const source = sources.find((source) => source.id === sourceId) ?? (sources.length === 1 ? sources[0] : undefined);
  const ready = Boolean(source && sourceReady(source, overview.accounts));
  const editing = Boolean(source && (!ready || settingsId === source.id));
  function select(id: string) { setSourceId(id); setSettingsId(null); }
  function configure(id: string) { setSourceId(id); setSettingsId(id); setManageOpen(false); }
  return {
    sources, source, ready, editing, manageOpen, select, configure,
    edit: () => { if (source) setSettingsId(source.id); },
    complete: () => setSettingsId(null), toggleManage: () => setManageOpen((open) => !open),
  };
}

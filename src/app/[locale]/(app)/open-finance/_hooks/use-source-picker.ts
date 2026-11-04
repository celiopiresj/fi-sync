"use client";

import { useState } from "react";
import { filterSources, groupSources } from "../_lib/options";
import type { SourcePickerProps } from "../_types/types";

export function useSourcePicker({ sources, accounts, onSelect }: Pick<SourcePickerProps, "sources" | "accounts" | "onSelect">) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const groups = groupSources(filterSources(sources, accounts, query)).filter((group) => group.sources.length > 0);
  return {
    open, query, groups, setQuery,
    changeOpen: (value: boolean) => { setOpen(value); if (!value) setQuery(""); },
    choose: (id: string) => { onSelect(id); setOpen(false); setQuery(""); },
  };
}

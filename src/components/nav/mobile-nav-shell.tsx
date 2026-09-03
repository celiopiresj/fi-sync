"use client";

import { useState } from "react";
import { MobileTabBar } from "@/components/nav/mobile-tab-bar";
import { MobileFab } from "@/components/nav/mobile-fab";
import { AddTransactionDrawer } from "@/app/[locale]/(app)/transactions/_components/form/add-transaction-drawer";

// Single mobile-only nav surface mounted once by (app)/layout.tsx — keeps
// that layout a pure composition (AGENTS.md: layout.tsx only composes)
// while this owns the one bit of shared state the shell needs: whether
// the FAB's "nova transação" drawer is open.
export function MobileNavShell() {
  const [addTransactionOpen, setAddTransactionOpen] = useState(false);

  return (
    <>
      <MobileTabBar />
      <MobileFab onClick={() => setAddTransactionOpen(true)} />
      <AddTransactionDrawer open={addTransactionOpen} onOpenChange={setAddTransactionOpen} />
    </>
  );
}

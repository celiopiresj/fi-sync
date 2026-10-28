import "dotenv/config";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import common from "../src/messages/pt-BR/common.json";
import messages from "../src/messages/pt-BR/scrn-open-finance.json";
import { ReviewForm } from "../src/app/[locale]/(app)/open-finance/_components/review-form";
import { TransactionTable } from "../src/app/[locale]/(app)/open-finance/_components/transaction-table";
import type { ReviewFormProps } from "../src/app/[locale]/(app)/open-finance/_types/types";

// Render the actual controls with synthetic cached data, without a browser
// session, provider requests or database reads/writes. Mutations must never
// fire while presenting a preview or rendering an editor.
const source = { id: "fixture-source", name: "Fixture bank", type: "BANK", currency: "BRL", accountId: "fixture-account", cardId: null, fromDate: "2026-10-01" };
const row = { id: "00000000-0000-4000-8000-000000000002", description: "Bank fixture original", date: "2026-10-28", amount: "-19.99", status: "POSTED" as const, payment: false };
const props: ReviewFormProps = {
  source, row, remaining: 2, onClose() {}, onProcessed() {},
  review: { description: row.description, amount: row.amount, date: row.date, matches: [], categories: [], destination: "Fixture destination", credit: false, pending: false, payment: false, closingDate: "", dueDate: "" },
};
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
queryClient.setQueryData(["open-finance-transactions", source.id, null], { error: null, data: { rows: [row], next: null } });
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch: async () => {}, hmrRefresh() {} };
const html = renderToString(
  <AppRouterContext.Provider value={router}>
    <NextIntlClientProvider locale="pt-BR" timeZone="America/Sao_Paulo" messages={{ common, "scrn-open-finance": messages }}>
      <QueryClientProvider client={queryClient}>
        <TransactionTable source={source} />
        <ReviewForm {...props} />
      </QueryClientProvider>
    </NextIntlClientProvider>
  </AppRouterContext.Provider>,
);
for (const key of ["description", "date", "type", "amount", "category"] as const) {
  assert.ok(html.includes(messages.fields[key].label), `Missing translated review control: ${key}`);
}
assert.ok(html.includes(messages.buttons.reviewSelected));
assert.ok(html.includes(messages.buttons.saveNext));
assert.ok(html.includes(messages.buttons.close));
assert.ok(html.includes(messages.dialog.create.original));
assert.ok(html.includes("Bank fixture original"));
assert.ok(html.includes('value="19,99"'));
assert.ok(html.includes('value="2026-10-28"'));
assert.ok(html.includes('role="checkbox"'));
assert.ok(!html.includes("MISSING_MESSAGE"));
assert.equal(queryClient.isMutating(), 0);
queryClient.clear();
console.log("UI render checks passed: selection, editable translated fields, bank reference, exact amount/date defaults and no writes while previewing.");

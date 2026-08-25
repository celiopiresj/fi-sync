import { listInvoices, getInvoiceFormOptions, getPayableAccounts } from "./actions";
import { currentInvoicePeriod } from "./_lib/period";
import { InvoicesView } from "./_components/invoices-view";

export default async function InvoicesPage() {
  // Same period the view's own stepper opens on by default — matched so
  // the client-side query only refetches once filters actually diverge
  // from what was server-rendered (see isDefaultFilters in
  // invoices-view.tsx, same pattern as transactions/recurrences).
  const [invoices, options, payableAccounts] = await Promise.all([
    listInvoices({ period: currentInvoicePeriod() }),
    getInvoiceFormOptions(),
    getPayableAccounts(),
  ]);

  return (
    <InvoicesView
      initialInvoices={invoices}
      accounts={options.accounts}
      payableAccounts={payableAccounts}
    />
  );
}

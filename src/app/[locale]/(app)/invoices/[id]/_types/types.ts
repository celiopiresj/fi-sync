export type InvoiceTransactionFilters = {
  categoryId?: string;
  personId?: string;
  type?: "all" | "income" | "expenses";
  purchaseKind?: "all" | "single" | "installment";
};

export type InvoiceSortGroupingMode = "grouped" | "flat";

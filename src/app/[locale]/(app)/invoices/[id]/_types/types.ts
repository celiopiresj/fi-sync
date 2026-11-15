export type InvoiceTransactionFilters = {
  categoryId?: string;
  personId?: string;
  type?: "all" | "income" | "expenses";
};

export type InvoiceSortGroupingMode = "grouped" | "flat";

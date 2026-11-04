import type { ProcessValues } from "@/lib/open-finance/schema";
import type { PreviewRow, Source } from "../_types/types";

// "Already recorded" reuses the regular processing path: a row with a
// matching transaction is linked to it (`match`), any other row only gets
// an import receipt (`ignore`). The bank values shown in the list go along
// so the server refuses the write if the bank changed the row meanwhile.
export function existingProcessValues(source: Source, row: PreviewRow & { amount: string }): ProcessValues {
  return {
    mode: row.existing ? "match" : "ignore",
    sourceId: source.id,
    transactionId: row.id,
    existingTransactionId: row.existing?.id ?? "",
    expectedDestination: { accountId: source.accountId ?? "", cardId: source.cardId ?? "", fromDate: source.fromDate ?? "" },
    closingDate: "",
    dueDate: "",
    expectedAmount: row.amount,
    expectedDate: row.date,
    expectedDescription: row.description,
  };
}

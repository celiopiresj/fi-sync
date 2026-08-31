import type {
  listLoans,
  getLoanDetail,
  getLoanFormOptions,
} from "../actions";

export type LoanRow = Awaited<ReturnType<typeof listLoans>>[number];
export type LoanDetail = NonNullable<Awaited<ReturnType<typeof getLoanDetail>>>;
export type LoanInstallmentRow = LoanDetail["installments"][number];
export type LoanFormOptions = Awaited<ReturnType<typeof getLoanFormOptions>>;
export type LoanPersonOption = LoanFormOptions["people"][number];
export type LoanAccountOption = LoanFormOptions["accounts"][number];

// The subset of fields LoanForm needs to prefill an edit — LoanRow
// (list screen, the only place editing is offered) satisfies this shape
// structurally, so it can be passed straight through without a mapping
// step.
export type LoanFormPrefill = {
  id: string;
  personId: string;
  description: string;
  dueDate: Date;
  installmentAmount: number;
  installmentCount: number;
};

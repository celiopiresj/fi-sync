// The account types money can be moved into or out of by a transfer:
// the ones that hold cash you actually have. A credit card is left out
// because paying it off is an invoice payment (invoices/actions.ts's
// payInvoice, which also settles the invoice), and investment/pocket
// accounts because moving money into one goes through the Investments
// screen's own aporte/resgate, which tags the movement for that screen.
//
// Shared by both places that post a two-leg transfer — the Investments
// screen's aporte/resgate and /transactions' own account-to-account
// transfer — so the two can't drift on which accounts qualify.
export const TRANSFERABLE_ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "CASH"] as const;

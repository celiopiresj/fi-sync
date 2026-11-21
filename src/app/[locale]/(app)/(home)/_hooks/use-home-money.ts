import { useFormatter } from "next-intl";

// Mask shown in place of every amount while balances are hidden.
const HIDDEN_AMOUNT = "•••••";

// BRL formatter for the home screen that honours the "hide balances"
// toggle. `signed` prints an explicit "+" on positive values (net change).
export function useHomeMoney(visible = true) {
  const format = useFormatter();
  return (value: number, options?: { signed?: boolean }) =>
    visible
      ? format.number(value, {
          style: "currency",
          currency: "BRL",
          signDisplay: options?.signed ? "exceptZero" : "auto",
        })
      : HIDDEN_AMOUNT;
}

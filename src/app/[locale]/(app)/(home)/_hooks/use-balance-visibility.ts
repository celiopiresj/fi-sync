import { useState } from "react";

// "Hide balances" privacy toggle shared by every amount on the home screen.
export function useBalanceVisibility() {
  const [visible, setVisible] = useState(true);
  return { visible, toggle: () => setVisible((current) => !current) };
}

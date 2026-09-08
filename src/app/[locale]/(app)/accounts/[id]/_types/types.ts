import type { getAccountDetail } from "../../actions";

export type AccountDetail = NonNullable<
  Awaited<ReturnType<typeof getAccountDetail>>
>;

export type AccountPersonBalance = AccountDetail["people"][number];

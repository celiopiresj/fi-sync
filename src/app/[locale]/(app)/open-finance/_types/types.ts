import type { getOpenFinanceOverview, getOpenFinanceTransactions, getOpenFinanceReview } from "../actions";
import type { useOpenFinanceScreen } from "../_hooks/use-pluggy-connection";

export type Overview = Awaited<ReturnType<typeof getOpenFinanceOverview>>;
export type Source = Overview["connections"][number]["sources"][number];
export type Preview = NonNullable<Awaited<ReturnType<typeof getOpenFinanceTransactions>>["data"]>;
export type PreviewRow = Preview["rows"][number];
export type Review = NonNullable<Awaited<ReturnType<typeof getOpenFinanceReview>>["data"]>;
export type ViewProps = { overview: Overview };
export type MappingFormProps = { source: Source; accounts: Overview["accounts"]; onReady: () => void; onCancel?: () => void };
export type SourceOption = Source & { bankLabel: string };
export type BanksManagementProps = ConnectControlProps & { overview: Overview; open: boolean; onSelect: (id: string) => void };
export type SourceSummaryProps = { source: Source; accounts: Overview["accounts"]; onEdit: () => void };
export type TransactionTableProps = { source: Source };
export type ReviewSheetProps = { source: Source; row: PreviewRow | null; remaining: number; onClose: () => void; onProcessed: () => void };
export type ReviewFormProps = { source: Source; row: PreviewRow; review: Review; remaining: number; onClose: () => void; onProcessed: () => void };
export type ConnectControlProps = { connection: ReturnType<typeof useOpenFinanceScreen>["connection"] };
export type WidgetFailure = {
  reason: "widget" | "widgetLoad" | "widgetDuplicate" | "widgetCredentials" | "widgetAuthorization" | "widgetToken" | "widgetConnector";
  code: string | null;
  keepOpen: boolean;
};

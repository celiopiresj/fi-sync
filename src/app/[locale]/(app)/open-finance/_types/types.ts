import type { getOpenFinanceOverview, getOpenFinanceTransactions, getOpenFinanceReview } from "../actions";
import type { useOpenFinanceScreen } from "../_hooks/use-pluggy-connection";

export type Overview = Awaited<ReturnType<typeof getOpenFinanceOverview>>;
export type Source = Overview["connections"][number]["sources"][number];
export type Preview = NonNullable<Awaited<ReturnType<typeof getOpenFinanceTransactions>>["data"]>;
export type PreviewRow = Omit<Preview["rows"][number], "paymentMethod" | "installmentNumber" | "installmentCount"> & {
  paymentMethod?: Preview["rows"][number]["paymentMethod"];
  installmentNumber?: number | null;
  installmentCount?: number | null;
};
export type PreviewDirection = "all" | "income" | "expense";
export type Review = NonNullable<Awaited<ReturnType<typeof getOpenFinanceReview>>["data"]>;
export type ViewProps = { overview: Overview };
export type MappingFormProps = { source: Source; accounts: Overview["accounts"]; onReady: () => void; onCancel?: () => void };
export type SourceOption = Source & { bankLabel: string; connectionId: string };
export type BanksManagementProps = { overview: Overview; open: boolean; onSelect: (id: string) => void };
export type SourceSidebarProps = { overview: Overview; sources: SourceOption[]; source?: SourceOption; onSelect: (id: string) => void; onManage: () => void; onConnect: () => void };
export type ImportStepsProps = { connected: boolean; selected: boolean; ready: boolean };
export type SourceSummaryProps = { source: Source; accounts: Overview["accounts"]; onEdit: () => void };
export type TransactionTableProps = {
  source: Source;
  accounts?: Overview["accounts"];
  categories?: Overview["categories"];
  people?: Overview["people"];
  defaultPersonId?: string;
};
export type ReviewSheetProps = {
  source: Source;
  row: PreviewRow | null;
  remaining: number;
  accounts?: Overview["accounts"];
  categories?: Overview["categories"];
  people?: Overview["people"];
  defaultPersonId?: string;
  onClose: () => void;
  onProcessed: () => void;
};
export type ReviewFormProps = { source: Source; row: PreviewRow; review: Review; remaining: number; onClose: () => void; onProcessed: () => void };
export type ConnectControlProps = { connection: ReturnType<typeof useOpenFinanceScreen>["connection"] };
export type WidgetFailure = {
  reason: "widget" | "widgetLoad" | "widgetDuplicate" | "widgetCredentials" | "widgetAuthorization" | "widgetToken" | "widgetConnector";
  code: string | null;
  keepOpen: boolean;
};

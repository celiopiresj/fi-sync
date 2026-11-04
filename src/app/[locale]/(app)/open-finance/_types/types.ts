import type { ReactNode } from "react";
import type { getOpenFinanceOverview, getOpenFinanceTransactions, getOpenFinanceReview } from "../actions";
import type { useOpenFinanceScreen } from "../_hooks/use-pluggy-connection";
import type { usePreviewReview } from "../_hooks/use-preview-review";

export type Overview = Awaited<ReturnType<typeof getOpenFinanceOverview>>;
export type Source = Overview["connections"][number]["sources"][number];
export type Preview = NonNullable<Awaited<ReturnType<typeof getOpenFinanceTransactions>>["data"]>;
export type PreviewRow = Omit<Preview["rows"][number], "paymentMethod" | "installmentNumber" | "installmentCount" | "existing"> & {
  existing?: Preview["rows"][number]["existing"];
  paymentMethod?: Preview["rows"][number]["paymentMethod"];
  installmentNumber?: number | null;
  installmentCount?: number | null;
};
export type PreviewDirection = "all" | "income" | "expense";
export type PreviewDay = { date: string; rows: PreviewRow[]; total: string };
export type MonthCount = { month: string; count: number | null; more: boolean };
export type Review = NonNullable<Awaited<ReturnType<typeof getOpenFinanceReview>>["data"]>;
export type ViewProps = { overview: Overview };
export type MappingFormProps = { source: Source; accounts: Overview["accounts"]; onReady: () => void; onCancel?: () => void };
export type SourceOption = Source & { bankLabel: string; connectionId: string };
export type BanksManagementProps = { overview: Overview; open: boolean; onOpenChange: (open: boolean) => void; onSelect: (id: string) => void; onConnect: () => void };
export type SourcePickerProps = { sources: SourceOption[]; source: SourceOption; accounts: Overview["accounts"]; onSelect: (id: string) => void };
export type ImportStepsProps = { connected: boolean; selected: boolean; ready: boolean };
export type SourceSummaryProps = SourcePickerProps & { onEdit?: () => void };
export type TransactionTableProps = {
  source: Source;
  header?: ReactNode;
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
export type PreviewState = ReturnType<typeof usePreviewReview>;
export type PreviewPanelProps = { preview: PreviewState };
export type MonthTabsProps = { months: MonthCount[]; value: string; onChange: (month: string) => void };
export type MonthSummaryProps = { summary: PreviewState["summary"] };
export type RowFlagsProps = { row: PreviewRow };
export type ExistingDialogProps = { preview: PreviewState };

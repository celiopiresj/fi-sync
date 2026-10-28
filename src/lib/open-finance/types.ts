export type SourceMapping = { accountId: string | null; cardId: string | null; fromDate: string | null };
export type MappingConflict = { sourceId: string; source: string; account: string; canReplace: boolean };

// Deliberately separate from provider configuration: missing credentials
// may show setup instructions to the owner, but must never expose the
// feature to anyone else. Never infer the owner from the first user.
export function isOpenFinanceOwner(userId: string | null | undefined): boolean {
  const ownerId = process.env.OPEN_FINANCE_USER_ID?.trim();
  return Boolean(ownerId && userId && ownerId === userId);
}

export function isPluggyConfigured(): boolean {
  return Boolean(process.env.PLUGGY_CLIENT_ID?.trim() && process.env.PLUGGY_CLIENT_SECRET?.trim());
}

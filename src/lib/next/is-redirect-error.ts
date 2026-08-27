// Next.js implements `redirect()` by throwing a special error (digest
// starts with "NEXT_REDIRECT") that the framework catches further up the
// tree. Any code wrapping a call chain that might redirect (e.g. a Server
// Action invoked from a client `onSubmit`) needs to re-throw this instead
// of treating it as a real failure — see sign-in/sign-up pages, which call
// actions that redirect() on success.
export function isNextRedirectError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

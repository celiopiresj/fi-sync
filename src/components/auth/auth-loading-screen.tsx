import { SpinnerIcon } from "@phosphor-icons/react/ssr";

type Props = {
  label: string;
};

// Full-screen loading state for the Google OAuth round-trip — shown by
// GoogleSignInButton while the browser is being sent to Google, and by
// /auth/callback's own loading.tsx while the session is being finished
// on the way back. Covers the whole viewport so the auth form underneath
// can't be clicked again mid-redirect.
export function AuthLoadingScreen({ label }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm"
    >
      <SpinnerIcon className="size-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

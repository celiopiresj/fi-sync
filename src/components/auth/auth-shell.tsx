import type { ReactNode } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  // Onboarding has no footer link (it's mandatory, no "sign in instead"/
  // "skip" escape hatch) — the other four auth screens all pass one.
  footer?: ReactNode;
};

// Shared page chrome for sign-in, sign-up, forgot-password,
// reset-password, and onboarding: logo lockup + heading + white card.
// Pulled out once several screens needed the identical wrapper instead of
// copy-pasting it per route.
export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-surface-1 px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo-full.png"
            alt="fi-sync logo"
            width={120}
            height={30}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <Card radius="lg" className="w-full max-w-sm gap-5 p-6 sm:p-8">
        {children}
      </Card>

      {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

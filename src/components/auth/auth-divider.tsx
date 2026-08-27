import { Separator } from "@/components/ui/separator";

type AuthDividerProps = {
  label: string;
};

// "OU COM E-MAIL" divider between the Google button and the
// email/password fields — sign-in and sign-up share it verbatim.
export function AuthDivider({ label }: AuthDividerProps) {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

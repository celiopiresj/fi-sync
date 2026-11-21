import type { ReactNode } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// The home screen's content block: a titled card with an optional
// one-line description and a right-aligned action (usually a
// `SectionLink`). Screens use it for any titled group of content (a chart,
// a list, an alert panel), so every block reads the same way across the
// app instead of each route hand-rolling its own header row.
type SectionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-3", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

// "Ver tudo ›" link placed in a SectionCard's `action` slot.
type SectionLinkProps = {
  href: string;
  children: ReactNode;
};

export function SectionLink({ href, children }: SectionLinkProps) {
  return (
    <Link
      href={href}
      className="flex min-h-9 shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline md:min-h-0"
    >
      {children}
      <CaretRightIcon aria-hidden="true" className="size-3.5" />
    </Link>
  );
}

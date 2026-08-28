import Image from "next/image";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS } from "../_constants/steps";

type OnboardingSidebarProps = {
  step: number;
};

// Fixed left column: logo, progress bar, and the vertical step list with
// active/completed states — same shape as the reference implementation's
// own SideBar (trilhofin), themed with fi-sync's own tokens/icons instead
// of DaisyUI + react-icons.
export function OnboardingSidebar({ step }: OnboardingSidebarProps) {
  const t = useTranslations("scrn-onboarding");
  const totalSteps = ONBOARDING_STEPS.length;
  const percent = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-6 border-r border-border bg-surface-1 p-6 lg:flex">
      <Image
        src="/logo-full.png"
        alt="fi-sync logo"
        width={120}
        height={30}
        className="object-contain"
        priority
      />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sidebar.progress")}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-right text-xs font-semibold text-primary">
          {t("sidebar.completed", { percent })}
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {ONBOARDING_STEPS.map((s, index) => {
          const isActive = step === index;
          const isCompleted = step > index;
          const Icon = s.icon;

          return (
            <div
              key={s.key}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : isCompleted
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <CheckIcon className="size-4" weight="bold" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">
                  {t(`steps.${s.key}.label`)}
                </span>
                <span className="truncate text-xs opacity-70">
                  {t(`steps.${s.key}.shortDescription`)}
                </span>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

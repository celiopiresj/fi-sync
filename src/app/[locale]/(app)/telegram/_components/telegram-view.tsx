"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  CopyIcon,
  LinkBreakIcon,
  TelegramLogoIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/screen/page-header";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TelegramStatus } from "../_types/types";
import { useTelegramMutations } from "../_hooks/use-telegram-mutations";

type TelegramViewProps = {
  status: TelegramStatus;
};

export function TelegramView({ status }: TelegramViewProps) {
  const t = useTranslations("scrn-telegram");
  const { generateCode, disconnect } = useTelegramMutations();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const command = status.code ? t("cards.code.command", { code: status.code }) : null;

  async function handleCopy() {
    if (!command) return;
    await navigator.clipboard.writeText(command);
    toast.success(t("toast.codeCopied"));
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span
              className={
                status.isLinked
                  ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-positive/10 text-positive"
                  : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              }
            >
              {status.isLinked ? (
                <CheckCircleIcon className="size-5" />
              ) : (
                <TelegramLogoIcon className="size-5" />
              )}
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle>
                {status.isLinked
                  ? t("cards.status.linked.title")
                  : t("cards.status.unlinked.title")}
              </CardTitle>
              <CardDescription>
                {status.isLinked
                  ? t("cards.status.linked.description")
                  : t("cards.status.unlinked.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {command && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-4">
              <span className="text-sm font-medium">{t("cards.code.title")}</span>
              <span className="text-xs text-muted-foreground">
                {t("cards.code.description", { minutes: status.ttlMinutes })}
              </span>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-background px-3 py-2 font-mono text-sm">
                  {command}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  <CopyIcon />
                  <span className="sr-only">{t("buttons.copy")}</span>
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => generateCode.mutate()}
              disabled={generateCode.isPending || disconnect.isPending}
            >
              <ArrowsClockwiseIcon />
              {status.code ? t("buttons.regenerate") : t("buttons.generate")}
            </Button>

            {status.botUsername && (
              <Button variant="outline" asChild>
                <a
                  href={`https://t.me/${status.botUsername}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <TelegramLogoIcon />
                  {t("buttons.openBot")}
                </a>
              </Button>
            )}

            {status.isLinked && (
              <Button
                variant="outline"
                className="text-negative"
                onClick={() => setConfirmingDisconnect(true)}
                disabled={disconnect.isPending}
              >
                <LinkBreakIcon />
                {t("buttons.disconnect")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("cards.steps.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex list-decimal flex-col gap-2 pl-4 text-sm text-muted-foreground">
              <li>{t("cards.steps.one")}</li>
              <li>{t("cards.steps.two")}</li>
              <li>{t("cards.steps.three")}</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("cards.examples.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-muted-foreground">
              <li>{t("cards.examples.one")}</li>
              <li>{t("cards.examples.two")}</li>
              <li>{t("cards.examples.three")}</li>
              <li>{t("cards.examples.four")}</li>
              <li>{t("cards.examples.five")}</li>
            </ul>
            <p className="text-xs text-muted-foreground">{t("cards.examples.note")}</p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmingDisconnect} onOpenChange={setConfirmingDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.disconnect.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.disconnect.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnect.isPending}>
              {t("dialog.disconnect.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={() => {
                disconnect.mutate();
                setConfirmingDisconnect(false);
              }}
            >
              {t("dialog.disconnect.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { createTelegramLinkCode, disconnectTelegram } from "../actions";

// Both mutations change data the page itself was server-rendered with, so
// they refresh the route on top of invalidating the query cache — the
// screen reads its status from the server component, not from a
// client-side query.
export function useTelegramMutations() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("scrn-telegram.toast");

  const generateCode = useMutation({
    mutationFn: () => createTelegramLinkCode(),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("codeGenerated"));
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
      router.refresh();
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectTelegram(),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("disconnected"));
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
      router.refresh();
    },
  });

  return { generateCode, disconnect };
}

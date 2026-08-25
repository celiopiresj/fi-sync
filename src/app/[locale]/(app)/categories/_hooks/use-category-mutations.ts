import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCategory, updateCategory, deleteCategory } from "../actions";
import type { CategoryFormValues } from "../_schema/schema";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const t = useTranslations("scrn-categories.toast");

  const create = useMutation({
    mutationFn: (data: CategoryFormValues) => createCategory(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("created"));
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryFormValues }) =>
      updateCategory(id, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("updated"));
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("deleted"));
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  return {
    create,
    update,
    remove,
  };
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  PencilSimpleIcon,
  TrashIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import type { GroupOption } from "../../_types/types";

type GroupManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: GroupOption[];
  onCreateGroup: (name: string) => Promise<void>;
  onUpdateGroup: (groupId: string, name: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  isPending: boolean;
};

export function GroupManagerDialog({
  open,
  onOpenChange,
  groups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  isPending,
}: GroupManagerDialogProps) {
  const t = useTranslations("scrn-budgets");
  const [newGroupName, setNewGroupName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function startEditing(group: GroupOption) {
    setEditingId(group.id);
    setEditingName(group.name);
  }

  async function handleCreate() {
    if (!newGroupName.trim()) return;
    await onCreateGroup(newGroupName.trim());
    setNewGroupName("");
  }

  async function handleUpdate() {
    if (!editingId || !editingName.trim()) return;
    await onUpdateGroup(editingId, editingName.trim());
    setEditingId(null);
    setEditingName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groups.title")}</DialogTitle>
          <DialogDescription>{t("groups.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              {t("groups.empty")}
            </p>
          )}

          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center gap-2"
            >
              {editingId === group.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleUpdate}
                    disabled={isPending}
                  >
                    {t("buttons.edit")}
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{group.name}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => startEditing(group)}
                  >
                    <PencilSimpleIcon className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onDeleteGroup(group.id)}
                    disabled={isPending}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </>
              )}
            </div>
          ))}

          {/* New group input */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder={t("fields.groupName.placeholder")}
              className="h-8 flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreate}
              disabled={isPending || !newGroupName.trim()}
            >
              <PlusIcon className="size-4 mr-1" />
              {t("groups.add")}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("dialog.copyPrevious.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

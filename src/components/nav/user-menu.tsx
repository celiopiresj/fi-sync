"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CaretUpDownIcon, SignOutIcon } from "@phosphor-icons/react";

function initialsFrom(value: string) {
  return value.slice(0, 2).toUpperCase();
}

import { useEffect, useState } from "react";

export function UserMenu() {
  const t = useTranslations("common");
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? email;

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/auth/sign-in");
  }

  if (!mounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton disabled className="h-auto py-1.5">
            <Avatar size="sm">
              <AvatarFallback></AvatarFallback>
            </Avatar>
            <span className="truncate"></span>
            <CaretUpDownIcon className="ml-auto" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton disabled={isPending} className="h-auto py-1.5">
              <Avatar size="sm">
                <AvatarFallback>
                  {name ? initialsFrom(name) : ""}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{name}</span>
              <CaretUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            {email && (
              <>
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={handleSignOut}>
              <SignOutIcon />
              {t("userMenu.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

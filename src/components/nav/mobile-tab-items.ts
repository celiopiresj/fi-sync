import type { ComponentType } from "react";
import {
  HouseIcon,
  ArrowsLeftRightIcon,
  WalletIcon,
  SquaresFourIcon,
  type IconProps,
} from "@phosphor-icons/react";

// Bottom tab bar entries (mobile only — see MobileTabBar). `labelKey`
// matches a key under `nav` in common.json, same convention as
// NavItem/nav-items.ts. Deliberately a separate, fixed list rather than a
// filtered slice of navItems: the bottom nav's 4 destinations don't map
// 1:1 onto the sidebar's grouped items (Carteira and Mais aggregate
// several sidebar entries each, see wallet/ and more/ routes).
export type MobileTabItem = {
  href: string;
  labelKey: "home" | "transactions" | "wallet" | "more";
  icon: ComponentType<IconProps>;
};

export const mobileTabItems: MobileTabItem[] = [
  { href: "/", labelKey: "home", icon: HouseIcon },
  { href: "/transactions", labelKey: "transactions", icon: ArrowsLeftRightIcon },
  { href: "/wallet", labelKey: "wallet", icon: WalletIcon },
  { href: "/more", labelKey: "more", icon: SquaresFourIcon },
];

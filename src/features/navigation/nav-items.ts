import type { Permission } from "@/domain/auth/permissions";

export type NavItem = {
  key: "dashboard" | "donors" | "pendingReview" | "requests" | "donations" | "communications" | "settings";
  href: string;
  permission: Permission;
  /** False until the phase that builds the screen ships (spec §15). */
  available: boolean;
};

// Information architecture from the brief (§28). Sub-items are added with their screens.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/dashboard", permission: "dashboard:read", available: true },
  { key: "donors", href: "/donors", permission: "donor:read", available: true },
  { key: "pendingReview", href: "/donors/pending", permission: "donor:verify", available: true },
  { key: "requests", href: "/requests", permission: "request:read", available: false },
  { key: "donations", href: "/donations", permission: "donor:read", available: false },
  { key: "communications", href: "/communications", permission: "communication:write", available: false },
  { key: "settings", href: "/settings", permission: "settings:manage", available: false },
];

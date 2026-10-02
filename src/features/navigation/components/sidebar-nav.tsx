"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { NavItem } from "@/features/navigation/nav-items";
import { cn } from "@/lib/utils";

/** Renders only the items the server already filtered by permission. */
export function SidebarNav({ items }: { items: readonly NavItem[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  // Highlight only the most specific match, so /donors/pending does not also light up /donors.
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .reduce<string | null>((best, i) => (!best || i.href.length > best.length ? i.href : best), null);

  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {items.map((item) => {
          const active = item.href === activeHref;
          if (!item.available) {
            return (
              <li key={item.key}>
                <span
                  aria-disabled="true"
                  title={t("comingSoon")}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/70"
                >
                  {t(item.key)}
                  <span className="hidden text-xs md:inline">{t("comingSoon")}</span>
                </span>
              </li>
            );
          }
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-muted",
                  active && "bg-muted text-foreground",
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

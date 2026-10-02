"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocaleAction } from "@/features/i18n/actions";
import { LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Each language is named in itself, so it is findable whatever is currently shown. */
const NATIVE_NAMES: Record<(typeof LOCALES)[number], string> = { ar: "العربية", en: "English" };

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: string) {
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={t("label")} className={cn("flex items-center gap-1 text-sm", className)}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          onClick={() => choose(locale)}
          disabled={pending || locale === current}
          aria-pressed={locale === current}
          className={cn(
            "rounded-md px-2 py-1 hover:bg-muted disabled:cursor-default",
            locale === current ? "bg-muted font-semibold" : "text-muted-foreground",
          )}
        >
          {NATIVE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}

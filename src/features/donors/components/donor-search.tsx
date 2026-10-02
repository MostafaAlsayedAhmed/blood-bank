"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchDonorsAction } from "@/features/donors/actions";
import { DonorTable } from "@/features/donors/components/donor-table";
import { EmptyState } from "@/components/shared/empty-state";
import { useFieldError } from "@/components/shared/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DonorFilters } from "@/domain/donor/schemas";
import type { DonorRow } from "@/server/queries/donors";

/**
 * Free-text search via a Server Action (POST), so names and phone numbers never
 * appear in URLs, browser history or access logs (spec §10). While a search is
 * active its results replace the server-rendered list passed as children.
 */
export function DonorSearch({ filters, children }: { filters: DonorFilters; children: React.ReactNode }) {
  const t = useTranslations("donors");
  const tErrors = useTranslations("errors");
  const fieldError = useFieldError();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DonorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await searchDonorsAction({ query, filters });
      if (result.ok) {
        setResults(result.data);
      } else {
        const key = result.fieldErrors?.query?.[0];
        setError(key ? fieldError(key) : tErrors(result.error));
      }
    });
  }

  function clear() {
    setQuery("");
    setResults(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} role="search" className="flex flex-col gap-2">
        <Label htmlFor="donor-search">{t("searchLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="donor-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className="max-w-sm"
            aria-describedby="donor-search-hint"
          />
          <Button type="submit" disabled={pending}>
            {t("searchSubmit")}
          </Button>
          {results ? (
            <Button variant="ghost" onClick={clear}>
              {t("searchClear")}
            </Button>
          ) : null}
        </div>
        <p id="donor-search-hint" className="text-xs text-muted-foreground">
          {t("searchHint")}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>

      {results === null ? (
        children
      ) : results.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <DonorTable rows={results} caption={t("searchResults")} />
      )}
    </div>
  );
}

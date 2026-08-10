import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, LifeBuoy, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import {
  getHelpCategories,
  helpUi,
  type HelpArticle,
} from "./_lib/help-content.ts";

export default function DashboardSupportPage() {
  const { lang } = useDashboardLocale();
  const [query, setQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<
    (HelpArticle & { category: string }) | null
  >(null);

  const categories = useMemo(() => getHelpCategories(lang), [lang]);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return categories;
    return categories
      .map((category) => ({
        ...category,
        articles: category.articles.filter((article) =>
          `${category.title} ${article.title} ${article.description}`
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((category) => category.articles.length > 0);
  }, [categories, normalizedQuery]);

  const resultCount = filteredCategories.reduce(
    (total, category) => total + category.articles.length,
    0,
  );

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-sky-50/50 px-4 pb-12 pt-16 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-7">
        <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6 text-center shadow-[0_24px_70px_-48px_rgba(14,116,202,0.45)] sm:p-10">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
            <LifeBuoy className="size-6" />
          </span>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600">
            {helpUi("eyebrow", lang)}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {helpUi("title", lang)}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
            {helpUi("subtitle", lang)}
          </p>

          <div className="relative mx-auto mt-6 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={helpUi("searchPlaceholder", lang)}
              aria-label={helpUi("searchAria", lang)}
              className="h-13 rounded-2xl border-slate-200 bg-white pl-12 pr-11 text-sm shadow-lg shadow-slate-200/50"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={helpUi("clearSearchAria", lang)}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">{helpUi("browseTitle", lang)}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {normalizedQuery
                  ? resultCount === 1
                    ? helpUi("resultsOne", lang)
                    : helpUi("resultsMany", lang, resultCount)
                  : helpUi("browseSubtitle", lang)}
              </p>
            </div>
          </div>

          {filteredCategories.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <article
                    key={category.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1",
                          category.tone,
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <h3 className="font-semibold">{category.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                      {category.articles.map((article) => (
                        <button
                          key={article.title}
                          type="button"
                          onClick={() =>
                            setSelectedArticle({
                              ...article,
                              category: category.title,
                            })
                          }
                          className="group flex w-full items-center justify-between gap-3 py-3 text-left"
                        >
                          <span className="text-sm font-medium text-slate-700 transition-colors group-hover:text-sky-700">
                            {article.title}
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Search className="mx-auto size-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold">{helpUi("emptyTitle", lang)}</p>
              <p className="mt-1 text-xs text-slate-500">{helpUi("emptySubtitle", lang)}</p>
              <Button variant="outline" onClick={() => setQuery("")} className="mt-4 rounded-xl">
                {helpUi("clearSearch", lang)}
              </Button>
            </div>
          )}
        </section>

        <section>
          <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-semibold">{helpUi("ctaTitle", lang)}</p>
              <p className="mt-1 text-xs text-slate-300">{helpUi("ctaSubtitle", lang)}</p>
            </div>
            <Button asChild className="shrink-0 rounded-xl bg-white text-slate-900 hover:bg-slate-100">
              <Link to="/contact">
                <Send className="mr-2 size-4" />
                {helpUi("ctaContact", lang)}
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={Boolean(selectedArticle)}
        onOpenChange={(open) => !open && setSelectedArticle(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-xl">
          {selectedArticle ? (
            <>
              <DialogHeader>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600">
                  {selectedArticle.category}
                </p>
                <DialogTitle className="text-xl">{selectedArticle.title}</DialogTitle>
                <DialogDescription>{selectedArticle.description}</DialogDescription>
              </DialogHeader>
              <ol className="mt-2 space-y-3">
                {selectedArticle.steps.map((step, index) => (
                  <li
                    key={`${selectedArticle.title}-${index}`}
                    className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm leading-5 text-slate-700">{step}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-sky-50 p-4">
                <p className="flex items-center gap-2 text-xs font-medium text-sky-800">
                  <BookOpen className="size-4" />
                  {helpUi("dialogMore", lang)}
                </p>
                <Button asChild variant="link" size="sm" className="text-sky-700">
                  <Link to="/contact">{helpUi("dialogAsk", lang)}</Link>
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ChefHat,
  CreditCard,
  LifeBuoy,
  PackagePlus,
  Printer,
  Search,
  Send,
  Settings2,
  Users,
  X,
} from "lucide-react";
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

type HelpArticle = {
  title: string;
  description: string;
  steps: string[];
};

type HelpCategory = {
  title: string;
  description: string;
  icon: typeof BookOpen;
  tone: string;
  articles: HelpArticle[];
};

const HELP_CATEGORIES: HelpCategory[] = [
  {
    title: "Getting Started",
    description: "Install, activate, and connect your first terminal.",
    icon: PackagePlus,
    tone: "bg-sky-50 text-sky-600 ring-sky-100",
    articles: [
      {
        title: "Install Vyntex POS",
        description: "Download and install the correct Windows build.",
        steps: [
          "Open Downloads from the dashboard and choose Windows x64 or ARM64.",
          "Run RestaurantPOSSetup.exe and allow Windows to complete the installation.",
          "Launch Vyntex POS from the desktop shortcut.",
        ],
      },
      {
        title: "Activate license",
        description: "Connect a POS installation to your business license.",
        steps: [
          "Open Vyntex POS and enter the 16-character license key from Licenses.",
          "Confirm that the business name and plan shown are correct.",
          "Create the first administrator or sign in with an existing employee PIN.",
        ],
      },
      {
        title: "Connect first device",
        description: "Register your first counter or terminal.",
        steps: [
          "Install and activate Vyntex POS with your license key.",
          "Open Devices in this dashboard and wait for the terminal to appear online.",
          "Rename the device and set its location, such as Main Counter.",
        ],
      },
    ],
  },
  {
    title: "POS",
    description: "Daily ordering, cancellations, and refunds.",
    icon: ChefHat,
    tone: "bg-orange-50 text-orange-600 ring-orange-100",
    articles: [
      {
        title: "Create an order",
        description: "Start an order and send items to preparation.",
        steps: [
          "Select a table or choose a takeaway order.",
          "Add products from the menu and adjust quantity or notes.",
          "Confirm the order to send items to the kitchen or bar.",
        ],
      },
      {
        title: "Cancel an order",
        description: "Void an open order safely.",
        steps: [
          "Open the active order from the table or orders list.",
          "Choose Cancel order and select or enter the cancellation reason.",
          "Confirm with an authorized employee PIN when requested.",
        ],
      },
      {
        title: "Process refund",
        description: "Refund a completed sale with an audit trail.",
        steps: [
          "Open Sales history and select the completed transaction.",
          "Choose Refund and select the items or full transaction.",
          "Confirm the refund method and authorization PIN.",
        ],
      },
    ],
  },
  {
    title: "Printers",
    description: "Receipt, kitchen, and printer troubleshooting.",
    icon: Printer,
    tone: "bg-violet-50 text-violet-600 ring-violet-100",
    articles: [
      {
        title: "Connect receipt printer",
        description: "Configure the printer used for customer receipts.",
        steps: [
          "Install the printer in Windows and print a Windows test page.",
          "In POS, open Settings → Printers and select the printer name.",
          "Set it as Receipt printer and run a Vyntex test print.",
        ],
      },
      {
        title: "Kitchen printer",
        description: "Route preparation tickets to the kitchen.",
        steps: [
          "Add the kitchen printer in Windows and verify that it is online.",
          "Open Settings → Printers and add it as a Kitchen printer.",
          "Assign the relevant menu categories and print a test ticket.",
        ],
      },
      {
        title: "Printer troubleshooting",
        description: "Fix missing, queued, or incorrectly formatted prints.",
        steps: [
          "Confirm that Windows shows the printer as Online and clear paused jobs.",
          "Check the selected printer name and paper width in POS Settings.",
          "Restart the printer and POS, then use Test print to verify the connection.",
        ],
      },
    ],
  },
  {
    title: "Payments",
    description: "Configure and use payment methods.",
    icon: CreditCard,
    tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    articles: [
      {
        title: "Configure payment methods",
        description: "Choose the methods available at checkout.",
        steps: [
          "Open POS Settings → Payments.",
          "Enable Cash, Card, or other methods used by your venue.",
          "Save changes and confirm the methods on the payment screen.",
        ],
      },
      {
        title: "Cash payments",
        description: "Complete a sale and calculate change.",
        steps: [
          "Choose Pay on the active order and select Cash.",
          "Enter the amount received from the customer.",
          "Confirm the calculated change and complete the sale.",
        ],
      },
      {
        title: "Card payments",
        description: "Record a card transaction correctly.",
        steps: [
          "Process the payment on your card terminal.",
          "Select Card in Vyntex POS after the terminal approves the payment.",
          "Confirm the amount and complete the sale to print the receipt.",
        ],
      },
    ],
  },
  {
    title: "Menu",
    description: "Products, categories, and pricing.",
    icon: Settings2,
    tone: "bg-cyan-50 text-cyan-600 ring-cyan-100",
    articles: [
      {
        title: "Add product",
        description: "Create a new sellable menu item.",
        steps: [
          "Open POS Settings → Menu and choose Add product.",
          "Enter the name, price, tax settings, and preparation category.",
          "Save the product and confirm that it appears on the order screen.",
        ],
      },
      {
        title: "Create category",
        description: "Organize products for faster ordering.",
        steps: [
          "Open Menu management and choose Add category.",
          "Set the category name, color, and display order.",
          "Assign products to the category and save.",
        ],
      },
      {
        title: "Change prices",
        description: "Update product pricing across connected devices.",
        steps: [
          "Open the product from Menu management.",
          "Edit its selling price and verify the tax configuration.",
          "Save; connected devices receive the cloud update automatically.",
        ],
      },
    ],
  },
  {
    title: "Employees",
    description: "Staff accounts, permissions, and PIN access.",
    icon: Users,
    tone: "bg-rose-50 text-rose-600 ring-rose-100",
    articles: [
      {
        title: "Add employee",
        description: "Create a POS account for a staff member.",
        steps: [
          "Open POS Settings → Staff and choose Add employee.",
          "Enter the employee name and select their role.",
          "Set a unique PIN and save the employee.",
        ],
      },
      {
        title: "Permissions",
        description: "Control access to sensitive POS actions.",
        steps: [
          "Open the employee profile in Staff settings.",
          "Choose the appropriate role and review its allowed actions.",
          "Save changes; the new permissions apply at the next PIN login.",
        ],
      },
      {
        title: "Employee PIN",
        description: "Create or reset a secure staff PIN.",
        steps: [
          "Open Staff settings and select the employee.",
          "Choose Change PIN and enter a unique PIN not used by another employee.",
          "Save and ask the employee to sign in again.",
        ],
      },
    ],
  },
];

export default function DashboardSupportPage() {
  const [query, setQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<
    (HelpArticle & { category: string }) | null
  >(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return HELP_CATEGORIES;
    return HELP_CATEGORIES.map((category) => ({
      ...category,
      articles: category.articles.filter((article) =>
        `${category.title} ${article.title} ${article.description}`
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    })).filter((category) => category.articles.length > 0);
  }, [normalizedQuery]);

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
            Help Center
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            What can we help you with?
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
            Search guides for setup, daily POS operations, printers, payments, menu, and employees.
          </p>

          <div className="relative mx-auto mt-6 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help articles..."
              aria-label="Search help articles"
              className="h-13 rounded-2xl border-slate-200 bg-white pl-12 pr-11 text-sm shadow-lg shadow-slate-200/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Browse by category</h2>
              <p className="mt-1 text-xs text-slate-500">
                {normalizedQuery
                  ? `${resultCount} article${resultCount === 1 ? "" : "s"} found`
                  : "Step-by-step answers for the most common tasks."}
              </p>
            </div>
          </div>

          {filteredCategories.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <article
                    key={category.title}
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
              <p className="mt-3 text-sm font-semibold">No articles found</p>
              <p className="mt-1 text-xs text-slate-500">
                Try another keyword or contact our support team.
              </p>
              <Button variant="outline" onClick={() => setQuery("")} className="mt-4 rounded-xl">
                Clear search
              </Button>
            </div>
          )}
        </section>

        <section>
          <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-semibold">Still need help?</p>
              <p className="mt-1 text-xs text-slate-300">
                Send your license key, device name, and a screenshot for a faster response.
              </p>
            </div>
            <Button asChild className="shrink-0 rounded-xl bg-white text-slate-900 hover:bg-slate-100">
              <Link to="/contact">
                <Send className="mr-2 size-4" />
                Contact support
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
          {selectedArticle && (
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
                    key={step}
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
                  Need more detail about this guide?
                </p>
                <Button asChild variant="link" size="sm" className="text-sky-700">
                  <Link to="/contact">Ask support</Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

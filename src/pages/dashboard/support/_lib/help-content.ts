import type { DashboardLang } from "@/lib/dashboard-i18n.ts";
import {
  BookOpen,
  ChefHat,
  CreditCard,
  PackagePlus,
  Printer,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";

export type HelpArticle = {
  title: string;
  description: string;
  steps: string[];
};

export type HelpCategory = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  articles: HelpArticle[];
};

type HelpArticleSource = {
  title: Record<DashboardLang, string>;
  description: Record<DashboardLang, string>;
  steps: Record<DashboardLang, string[]>;
};

type HelpCategorySource = {
  id: string;
  title: Record<DashboardLang, string>;
  description: Record<DashboardLang, string>;
  icon: LucideIcon;
  tone: string;
  articles: HelpArticleSource[];
};

const HELP_CATEGORY_SOURCES: HelpCategorySource[] = [
  {
    id: "getting-started",
    title: { en: "Getting Started", sq: "Fillimi" },
    description: {
      en: "Install, activate, and connect your first terminal.",
      sq: "Instaloni, aktivizoni dhe lidhni terminalin e parë.",
    },
    icon: PackagePlus,
    tone: "bg-sky-50 text-sky-600 ring-sky-100",
    articles: [
      {
        title: { en: "Install Vyntex POS", sq: "Instaloni Vyntex POS" },
        description: {
          en: "Download and install the correct Windows build.",
          sq: "Shkarkoni dhe instaloni versionin e duhur të Windows.",
        },
        steps: {
          en: [
            "Open Downloads from the dashboard and choose Windows x64 or ARM64.",
            "Run RestaurantPOSSetup.exe and allow Windows to complete the installation.",
            "Launch Vyntex POS from the desktop shortcut.",
          ],
          sq: [
            "Hapni Shkarkimet nga paneli dhe zgjidhni Windows x64 ose ARM64.",
            "Ekzekutoni RestaurantPOSSetup.exe dhe lejoni Windows të përfundojë instalimin.",
            "Hapni Vyntex POS nga shkurtuesi në desktop.",
          ],
        },
      },
      {
        title: { en: "Activate license", sq: "Aktivizoni licencën" },
        description: {
          en: "Connect a POS installation to your business license.",
          sq: "Lidhni instalimin e POS me licencën e biznesit tuaj.",
        },
        steps: {
          en: [
            "Open Vyntex POS and enter the 16-character license key from Licenses.",
            "Confirm that the business name and plan shown are correct.",
            "Create the first administrator or sign in with an existing employee PIN.",
          ],
          sq: [
            "Hapni Vyntex POS dhe vendosni çelësin 16-shifror të licencës nga Licencat.",
            "Konfirmoni që emri i biznesit dhe plani i shfaqur janë të saktë.",
            "Krijoni administratorin e parë ose hyni me PIN-in ekzistues të punonjësit.",
          ],
        },
      },
      {
        title: { en: "Connect first device", sq: "Lidhni pajisjen e parë" },
        description: {
          en: "Register your first counter or terminal.",
          sq: "Regjistroni arkat ose terminalin e parë.",
        },
        steps: {
          en: [
            "Install and activate Vyntex POS with your license key.",
            "Open Devices in this dashboard and wait for the terminal to appear online.",
            "Rename the device and set its location, such as Main Counter.",
          ],
          sq: [
            "Instaloni dhe aktivizoni Vyntex POS me çelësin e licencës.",
            "Hapni Pajisjet në këtë panel dhe prisni që terminali të shfaqet online.",
            "Riemërtoni pajisjen dhe vendosni lokacionin, p.sh. Arka kryesore.",
          ],
        },
      },
    ],
  },
  {
    id: "pos",
    title: { en: "POS", sq: "POS" },
    description: {
      en: "Daily ordering, cancellations, and refunds.",
      sq: "Porositë ditore, anulimet dhe rimbursimet.",
    },
    icon: ChefHat,
    tone: "bg-orange-50 text-orange-600 ring-orange-100",
    articles: [
      {
        title: { en: "Create an order", sq: "Krijoni një porosi" },
        description: {
          en: "Start an order and send items to preparation.",
          sq: "Filloni një porosi dhe dërgoni artikujt për përgatitje.",
        },
        steps: {
          en: [
            "Select a table or choose a takeaway order.",
            "Add products from the menu and adjust quantity or notes.",
            "Confirm the order to send items to the kitchen or bar.",
          ],
          sq: [
            "Zgjidhni një tavolinë ose një porosi për takeaway.",
            "Shtoni produkte nga menuja dhe rregulloni sasinë ose shënimet.",
            "Konfirmoni porosinë për t’i dërguar artikujt në kuzhinë ose bar.",
          ],
        },
      },
      {
        title: { en: "Cancel an order", sq: "Anuloni një porosi" },
        description: {
          en: "Void an open order safely.",
          sq: "Anuloni një porosi të hapur në mënyrë të sigurt.",
        },
        steps: {
          en: [
            "Open the active order from the table or orders list.",
            "Choose Cancel order and select or enter the cancellation reason.",
            "Confirm with an authorized employee PIN when requested.",
          ],
          sq: [
            "Hapni porosinë aktive nga tavolina ose lista e porosive.",
            "Zgjidhni Anulo porosinë dhe zgjidhni ose shkruani arsyen e anulimit.",
            "Konfirmoni me PIN-in e autorizuar të punonjësit kur kërkohet.",
          ],
        },
      },
      {
        title: { en: "Process refund", sq: "Procesoni rimbursimin" },
        description: {
          en: "Refund a completed sale with an audit trail.",
          sq: "Rimbursoni një shitje të përfunduar me gjurmë auditimi.",
        },
        steps: {
          en: [
            "Open Sales history and select the completed transaction.",
            "Choose Refund and select the items or full transaction.",
            "Confirm the refund method and authorization PIN.",
          ],
          sq: [
            "Hapni historikun e shitjeve dhe zgjidhni transakcionin e përfunduar.",
            "Zgjidhni Rimbursim dhe artikujt ose transakcionin e plotë.",
            "Konfirmoni metodën e rimbursimit dhe PIN-in e autorizimit.",
          ],
        },
      },
    ],
  },
  {
    id: "printers",
    title: { en: "Printers", sq: "Printerët" },
    description: {
      en: "Receipt, kitchen, and printer troubleshooting.",
      sq: "Faturat, kuzhina dhe zgjidhja e problemeve me printerët.",
    },
    icon: Printer,
    tone: "bg-violet-50 text-violet-600 ring-violet-100",
    articles: [
      {
        title: { en: "Connect receipt printer", sq: "Lidhni printerin e faturave" },
        description: {
          en: "Configure the printer used for customer receipts.",
          sq: "Konfiguroni printerin për faturat e klientit.",
        },
        steps: {
          en: [
            "Install the printer in Windows and print a Windows test page.",
            "In POS, open Settings → Printers and select the printer name.",
            "Set it as Receipt printer and run a Vyntex test print.",
          ],
          sq: [
            "Instaloni printerin në Windows dhe printoni një faqe testimi.",
            "Në POS, hapni Cilësimet → Printerët dhe zgjidhni emrin e printerit.",
            "Vendoseni si printer faturash dhe bëni një printim prove Vyntex.",
          ],
        },
      },
      {
        title: { en: "Kitchen printer", sq: "Printeri i kuzhinës" },
        description: {
          en: "Route preparation tickets to the kitchen.",
          sq: "Dërgoni bileta përgatitjeje në kuzhinë.",
        },
        steps: {
          en: [
            "Add the kitchen printer in Windows and verify that it is online.",
            "Open Settings → Printers and add it as a Kitchen printer.",
            "Assign the relevant menu categories and print a test ticket.",
          ],
          sq: [
            "Shtoni printerin e kuzhinës në Windows dhe verifikoni që është online.",
            "Hapni Cilësimet → Printerët dhe shtojeni si printer kuzhine.",
            "Caktoni kategoritë e menysë dhe printoni një biletë prove.",
          ],
        },
      },
      {
        title: { en: "Printer troubleshooting", sq: "Zgjidhja e problemeve me printerin" },
        description: {
          en: "Fix missing, queued, or incorrectly formatted prints.",
          sq: "Rregulloni printime që mungojnë, janë në radhë ose me format të gabuar.",
        },
        steps: {
          en: [
            "Confirm that Windows shows the printer as Online and clear paused jobs.",
            "Check the selected printer name and paper width in POS Settings.",
            "Restart the printer and POS, then use Test print to verify the connection.",
          ],
          sq: [
            "Konfirmoni që Windows e tregon printerin Online dhe pastroni punët e pezulluara.",
            "Kontrolloni emrin e printerit dhe gjerësinë e letrës në Cilësimet e POS.",
            "Rinisni printerin dhe POS-in, pastaj përdorni Printim prove për të verifikuar lidhjen.",
          ],
        },
      },
    ],
  },
  {
    id: "payments",
    title: { en: "Payments", sq: "Pagesat" },
    description: {
      en: "Configure and use payment methods.",
      sq: "Konfiguroni dhe përdorni metodat e pagesës.",
    },
    icon: CreditCard,
    tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    articles: [
      {
        title: { en: "Configure payment methods", sq: "Konfiguroni metodat e pagesës" },
        description: {
          en: "Choose the methods available at checkout.",
          sq: "Zgjidhni metodat e disponueshme në arkë.",
        },
        steps: {
          en: [
            "Open POS Settings → Payments.",
            "Enable Cash, Card, or other methods used by your venue.",
            "Save changes and confirm the methods on the payment screen.",
          ],
          sq: [
            "Hapni Cilësimet e POS → Pagesat.",
            "Aktivizoni Cash, Kartë ose metoda të tjera që përdor lokali juaj.",
            "Ruani ndryshimet dhe konfirmoni metodat në ekranin e pagesës.",
          ],
        },
      },
      {
        title: { en: "Cash payments", sq: "Pagesat me cash" },
        description: {
          en: "Complete a sale and calculate change.",
          sq: "Përfundoni një shitje dhe llogaritni kusurin.",
        },
        steps: {
          en: [
            "Choose Pay on the active order and select Cash.",
            "Enter the amount received from the customer.",
            "Confirm the calculated change and complete the sale.",
          ],
          sq: [
            "Zgjidhni Paguaj te porosia aktive dhe zgjidhni Cash.",
            "Vendosni shumën e marrë nga klienti.",
            "Konfirmoni kusurin e llogaritur dhe përfundoni shitjen.",
          ],
        },
      },
      {
        title: { en: "Card payments", sq: "Pagesat me kartë" },
        description: {
          en: "Record a card transaction correctly.",
          sq: "Regjistroni saktë një transakcion me kartë.",
        },
        steps: {
          en: [
            "Process the payment on your card terminal.",
            "Select Card in Vyntex POS after the terminal approves the payment.",
            "Confirm the amount and complete the sale to print the receipt.",
          ],
          sq: [
            "Procesoni pagesën në terminalin e kartës.",
            "Zgjidhni Kartë në Vyntex POS pasi terminali ta ketë aprovuar pagesën.",
            "Konfirmoni shumën dhe përfundoni shitjen për të printuar faturën.",
          ],
        },
      },
    ],
  },
  {
    id: "menu",
    title: { en: "Menu", sq: "Menuja" },
    description: {
      en: "Products, categories, and pricing.",
      sq: "Produktet, kategoritë dhe çmimet.",
    },
    icon: Settings2,
    tone: "bg-cyan-50 text-cyan-600 ring-cyan-100",
    articles: [
      {
        title: { en: "Add product", sq: "Shtoni produkt" },
        description: {
          en: "Create a new sellable menu item.",
          sq: "Krijoni një artikull të ri në menu.",
        },
        steps: {
          en: [
            "Open POS Settings → Menu and choose Add product.",
            "Enter the name, price, tax settings, and preparation category.",
            "Save the product and confirm that it appears on the order screen.",
          ],
          sq: [
            "Hapni Cilësimet e POS → Menu dhe zgjidhni Shto produkt.",
            "Vendosni emrin, çmimin, taksat dhe kategorinë e përgatitjes.",
            "Ruani produktin dhe konfirmoni që shfaqet në ekranin e porosive.",
          ],
        },
      },
      {
        title: { en: "Create category", sq: "Krijoni kategori" },
        description: {
          en: "Organize products for faster ordering.",
          sq: "Organizoni produktet për porosi më të shpejta.",
        },
        steps: {
          en: [
            "Open Menu management and choose Add category.",
            "Set the category name, color, and display order.",
            "Assign products to the category and save.",
          ],
          sq: [
            "Hapni menaxhimin e menysë dhe zgjidhni Shto kategori.",
            "Vendosni emrin, ngjyrën dhe rendin e shfaqjes së kategorisë.",
            "Caktoni produktet në kategori dhe ruani.",
          ],
        },
      },
      {
        title: { en: "Change prices", sq: "Ndryshoni çmimet" },
        description: {
          en: "Update product pricing across connected devices.",
          sq: "Përditësoni çmimet në të gjitha pajisjet e lidhura.",
        },
        steps: {
          en: [
            "Open the product from Menu management.",
            "Edit its selling price and verify the tax configuration.",
            "Save; connected devices receive the cloud update automatically.",
          ],
          sq: [
            "Hapni produktin nga menaxhimi i menysë.",
            "Ndryshoni çmimin e shitjes dhe verifikoni konfigurimin e taksave.",
            "Ruani; pajisjet e lidhura marrin përditësimin nga cloud automatikisht.",
          ],
        },
      },
    ],
  },
  {
    id: "employees",
    title: { en: "Employees", sq: "Punonjësit" },
    description: {
      en: "Staff accounts, permissions, and PIN access.",
      sq: "Llogaritë e stafit, lejet dhe qasja me PIN.",
    },
    icon: Users,
    tone: "bg-rose-50 text-rose-600 ring-rose-100",
    articles: [
      {
        title: { en: "Add employee", sq: "Shtoni punonjës" },
        description: {
          en: "Create a POS account for a staff member.",
          sq: "Krijoni një llogari POS për një anëtar të stafit.",
        },
        steps: {
          en: [
            "Open POS Settings → Staff and choose Add employee.",
            "Enter the employee name and select their role.",
            "Set a unique PIN and save the employee.",
          ],
          sq: [
            "Hapni Cilësimet e POS → Stafi dhe zgjidhni Shto punonjës.",
            "Vendosni emrin e punonjësit dhe zgjidhni rolin.",
            "Vendosni një PIN unik dhe ruani punonjësin.",
          ],
        },
      },
      {
        title: { en: "Permissions", sq: "Lejet" },
        description: {
          en: "Control access to sensitive POS actions.",
          sq: "Kontrolloni qasjen te veprimet e ndjeshme të POS.",
        },
        steps: {
          en: [
            "Open the employee profile in Staff settings.",
            "Choose the appropriate role and review its allowed actions.",
            "Save changes; the new permissions apply at the next PIN login.",
          ],
          sq: [
            "Hapni profilin e punonjësit te cilësimet e Stafit.",
            "Zgjidhni rolin e duhur dhe shqyrtoni veprimet e lejuara.",
            "Ruani ndryshimet; lejet e reja zbatohen në hyrjen e radhës me PIN.",
          ],
        },
      },
      {
        title: { en: "Employee PIN", sq: "PIN-i i punonjësit" },
        description: {
          en: "Create or reset a secure staff PIN.",
          sq: "Krijoni ose rivendosni një PIN të sigurt për stafin.",
        },
        steps: {
          en: [
            "Open Staff settings and select the employee.",
            "Choose Change PIN and enter a unique PIN not used by another employee.",
            "Save and ask the employee to sign in again.",
          ],
          sq: [
            "Hapni cilësimet e Stafit dhe zgjidhni punonjësin.",
            "Zgjidhni Ndrysho PIN dhe vendosni një PIN unik që nuk e përdor dikush tjetër.",
            "Ruani dhe kërkojini punonjësit të hyjë përsëri.",
          ],
        },
      },
    ],
  },
];

export function getHelpCategories(lang: DashboardLang): HelpCategory[] {
  return HELP_CATEGORY_SOURCES.map((category) => ({
    id: category.id,
    title: category.title[lang],
    description: category.description[lang],
    icon: category.icon,
    tone: category.tone,
    articles: category.articles.map((article) => ({
      title: article.title[lang],
      description: article.description[lang],
      steps: article.steps[lang],
    })),
  }));
}

export const HELP_UI = {
  eyebrow: { en: "Help Center", sq: "Qendra e ndihmës" },
  title: {
    en: "What can we help you with?",
    sq: "Si mund t’ju ndihmojmë?",
  },
  subtitle: {
    en: "Search guides for setup, daily POS operations, printers, payments, menu, and employees.",
    sq: "Kërkoni udhëzues për konfigurimin, punën ditore në POS, printerët, pagesat, menynë dhe punonjësit.",
  },
  searchPlaceholder: {
    en: "Search help articles...",
    sq: "Kërkoni artikuj ndihme...",
  },
  searchAria: { en: "Search help articles", sq: "Kërko artikuj ndihme" },
  clearSearchAria: { en: "Clear search", sq: "Pastro kërkimin" },
  browseTitle: { en: "Browse by category", sq: "Shfletoni sipas kategorisë" },
  browseSubtitle: {
    en: "Step-by-step answers for the most common tasks.",
    sq: "Përgjigje hap pas hapi për detyrat më të zakonshme.",
  },
  resultsOne: { en: "1 article found", sq: "1 artikull u gjet" },
  resultsMany: {
    en: "{{count}} articles found",
    sq: "{{count}} artikuj u gjetën",
  },
  emptyTitle: { en: "No articles found", sq: "Nuk u gjet asnjë artikull" },
  emptySubtitle: {
    en: "Try another keyword or contact our support team.",
    sq: "Provoni një fjalë tjetër ose kontaktoni ekipin e suportit.",
  },
  clearSearch: { en: "Clear search", sq: "Pastro kërkimin" },
  ctaTitle: { en: "Still need help?", sq: "Keni ende nevojë për ndihmë?" },
  ctaSubtitle: {
    en: "Send your license key, device name, and a screenshot for a faster response.",
    sq: "Dërgoni çelësin e licencës, emrin e pajisjes dhe një screenshot për përgjigje më të shpejtë.",
  },
  ctaContact: { en: "Contact support", sq: "Kontaktoni suportin" },
  dialogMore: {
    en: "Need more detail about this guide?",
    sq: "Ju duhen më shumë detaje për këtë udhëzues?",
  },
  dialogAsk: { en: "Ask support", sq: "Pyetni suportin" },
} as const satisfies Record<string, Record<DashboardLang, string>>;

export function helpUi(key: keyof typeof HELP_UI, lang: DashboardLang, count?: number): string {
  const raw = HELP_UI[key][lang];
  if (count == null) return raw;
  return raw.replaceAll("{{count}}", String(count));
}

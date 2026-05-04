import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

export default function Footer() {
  const { t } = useTranslation("site");

  const footerColumns: { categoryKey: string; links: { labelKey: string; href: string }[] }[] =
    [
      {
        categoryKey: "footer.product",
        links: [
          { labelKey: "footer.features", href: "/" },
          { labelKey: "nav.vynTypes", href: "/vyn-types" },
          { labelKey: "nav.pricing", href: "/pricing" },
        ],
      },
      {
        categoryKey: "footer.company",
        links: [
          { labelKey: "footer.aboutLink", href: "/about" },
          { labelKey: "footer.contactLink", href: "/contact" },
          { labelKey: "Instagram", href: "https://instagram.com/vyntexpos" },
        ],
      },
      {
        categoryKey: "footer.legal",
        links: [
          { labelKey: "footer.terms", href: "/legal/terms" },
          { labelKey: "footer.privacy", href: "/legal/privacy" },
        ],
      },
    ];

  return (
    <footer className="bg-[#060B18] text-white/70 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={LOGO_URL} alt="Vyntex POS" className="w-8 h-8" />
              <span className="text-lg font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
                Vyntex POS
              </span>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed">{t("footer.tagline")}</p>
          </div>

          {footerColumns.map((col) => (
            <div key={col.categoryKey}>
              <h4 className="text-sm font-semibold text-white/90 mb-4">
                {t(col.categoryKey)}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.labelKey}>
                    {link.href.startsWith("http") ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-white/40 hover:text-white/70 transition-colors"
                      >
                        {link.labelKey}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-white/40 hover:text-white/70 transition-colors"
                      >
                        {t(link.labelKey)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Vyntex POS · {t("footer.version", { v: APP_VERSION_LABEL })}{" "}
            {t("footer.rights")}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#44CC00]" />
            <span className="text-xs text-white/30">{t("footer.operational")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

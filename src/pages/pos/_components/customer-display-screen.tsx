import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_POS_CUSTOMER_DISPLAY,
  parsePosCustomerDisplay,
  postCustomerDisplayMessage,
  readCachedCustomerDisplaySnapshot,
  readLocalCustomerDisplay,
  subscribeCustomerDisplay,
  type CustomerDisplaySnapshot,
} from "@/lib/pos-customer-display.ts";
import { POS_DEFAULT_LANGUAGE } from "@/lib/pos-locale-defaults.ts";
import { translatePos } from "../_lib/pos-i18n.ts";

function tDisplay(language: "en" | "sq", key: string) {
  return translatePos(key, undefined, language);
}

function licenseFromUrl(): string {
  try {
    const q = new URLSearchParams(window.location.search).get("license");
    if (q?.trim()) return q.trim();
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem("vyntex.pos.lastLicenseKey");
    return raw?.trim() || "";
  } catch {
    return "";
  }
}

export default function CustomerDisplayScreen() {
  const licenseKey = licenseFromUrl();
  const [snap, setSnap] = useState<CustomerDisplaySnapshot | null>(() =>
    licenseKey ? readCachedCustomerDisplaySnapshot(licenseKey) : null,
  );

  useEffect(() => {
    const settings = licenseKey
      ? readLocalCustomerDisplay(licenseKey)
      : DEFAULT_POS_CUSTOMER_DISPLAY;
    if (!snap) {
      setSnap({
        v: 1,
        kind: "snapshot",
        licenseKey,
        at: Date.now(),
        phase: "welcome",
        venueName: "",
        settings,
        items: [],
        subtotal: "",
        tax: "",
        total: "",
        change: "",
      });
    }
    const stop = subscribeCustomerDisplay((message) => {
      if (message.kind === "close") {
        window.close();
        return;
      }
      if (message.kind === "snapshot") {
        setSnap(message);
      }
    });
    const beat = window.setInterval(() => {
      postCustomerDisplayMessage({ kind: "alive", at: Date.now() });
    }, 2000);
    postCustomerDisplayMessage({ kind: "alive", at: Date.now() });
    return () => {
      stop();
      window.clearInterval(beat);
    };
  }, [licenseKey]);

  const settings = parsePosCustomerDisplay(snap?.settings);
  const language = settings.language || POS_DEFAULT_LANGUAGE;
  const t = (key: string) => tDisplay(language, key);
  const welcome =
    settings.welcomeMessage.trim() || t("settings.cd_welcome_default");
  const showWelcome = !settings.enabled || !snap || snap.phase === "welcome" || snap.items.length === 0;
  const items = snap?.items ?? [];

  const totals = useMemo(
    () => [
      settings.showSubtotal && snap?.subtotal
        ? { label: t("common.subtotal"), value: snap.subtotal }
        : null,
      settings.showTax && snap?.tax ? { label: t("common.tax"), value: snap.tax } : null,
      settings.showTotal && snap?.total
        ? { label: t("common.total"), value: snap.total }
        : null,
    ].filter(Boolean) as { label: string; value: string }[],
    [settings.showSubtotal, settings.showTax, settings.showTotal, snap, language],
  );

  return (
    <div className="flex min-h-svh flex-col bg-[#070B16] px-8 py-10 text-white">
      <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#8b93a7]">
        {snap?.venueName || t("settings.cd_guest_title")}
      </p>
      {showWelcome ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            {welcome}
          </p>
        </div>
      ) : (
        <div className="mt-8 flex min-h-0 flex-1 flex-col gap-8">
          {settings.showItems ? (
            <ul className="min-h-0 flex-1 space-y-3 overflow-auto text-2xl">
              {items.map((row, i) => (
                <li key={`${row.name}-${i}`} className="flex items-baseline justify-between gap-6">
                  <span className="min-w-0">
                    <span className="text-[#8b93a7]">{row.quantity}×</span> {row.name}
                  </span>
                  <span className="shrink-0 tabular-nums">{row.lineTotal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex-1" />
          )}
          <div className="space-y-2 border-t border-white/10 pt-6 text-2xl">
            {totals.map((row) => (
              <div
                key={row.label}
                className="flex justify-between gap-6 text-[#d5dbe8]"
              >
                <span>{row.label}</span>
                <span className="tabular-nums">{row.value}</span>
              </div>
            ))}
            {settings.showChange && snap?.phase === "change" && snap.change ? (
              <div className="flex justify-between gap-6 pt-2 text-4xl font-semibold text-emerald-300">
                <span>{t("settings.cd_change")}</span>
                <span className="tabular-nums">{snap.change}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

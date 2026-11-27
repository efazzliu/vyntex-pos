import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

/** Shared chrome for light UI mockups on the Features page. */
function MockChrome({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-[#FAFAFA] px-4 py-2.5">
        <span className="size-2 rounded-full bg-neutral-300" />
        <span className="size-2 rounded-full bg-neutral-300" />
        <span className="size-2 rounded-full bg-neutral-300" />
        <span className="ml-2 text-[11px] font-medium text-neutral-400">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function PosOrderingMock() {
  return (
    <MockChrome title="POS · Order">
      <div className="grid grid-cols-[0.85fr_1.15fr] gap-3">
        <div className="space-y-1.5">
          {["Pizza", "Burgers", "Pasta", "Drinks"].map((label, i) => (
            <div
              key={label}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold",
                i === 0 ? "bg-[#E31E24] text-white" : "bg-neutral-100 text-neutral-600",
              )}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Current order
          </p>
          {[
            ["Margherita", "€9.50"],
            ["Extra cheese", "+€1.00"],
            ["Cola", "€2.00"],
          ].map(([name, price]) => (
            <div key={name} className="mt-2 flex justify-between text-xs text-neutral-700">
              <span>{name}</span>
              <span className="font-semibold">{price}</span>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm font-bold text-neutral-900">
            <span>Total</span>
            <span>€12.50</span>
          </div>
          <div className="mt-2 rounded-lg bg-[#E31E24] py-2 text-center text-xs font-bold text-white">
            Pay · Split
          </div>
        </div>
      </div>
    </MockChrome>
  );
}

export function TablesMock() {
  return (
    <MockChrome title="Floor · Tables">
      <div className="grid grid-cols-3 gap-2">
        {[
          { n: "T1", s: "free" },
          { n: "T2", s: "busy" },
          { n: "T3", s: "free" },
          { n: "T4", s: "busy" },
          { n: "T5", s: "reserved" },
          { n: "T6", s: "free" },
        ].map((t) => (
          <div
            key={t.n}
            className={cn(
              "flex aspect-square flex-col items-center justify-center rounded-xl border text-xs font-semibold",
              t.s === "busy" && "border-[#E31E24]/40 bg-[#FFF5F5] text-[#E31E24]",
              t.s === "free" && "border-neutral-200 bg-white text-neutral-600",
              t.s === "reserved" && "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {t.n}
            <span className="mt-0.5 text-[9px] font-medium uppercase opacity-70">{t.s}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-600">
          Zone A
        </span>
        <span className="rounded-full bg-[#E31E24]/10 px-2.5 py-1 text-[10px] font-semibold text-[#E31E24]">
          Zone B
        </span>
      </div>
    </MockChrome>
  );
}

export function KdsMock() {
  return (
    <MockChrome title="Kitchen Display">
      <div className="grid grid-cols-2 gap-2">
        {[
          { id: "#104", items: "2× Burger, Fries", status: "Preparing", tone: "busy" },
          { id: "#105", items: "Pasta, Salad", status: "Queued", tone: "wait" },
          { id: "#106", items: "Pizza Margherita", status: "Ready", tone: "ok" },
          { id: "#107", items: "Steak, Wine", status: "Priority", tone: "prio" },
        ].map((ticket) => (
          <div
            key={ticket.id}
            className={cn(
              "rounded-xl border p-2.5",
              ticket.tone === "busy" && "border-[#E31E24]/30 bg-[#FFF5F5]",
              ticket.tone === "wait" && "border-neutral-200 bg-neutral-50",
              ticket.tone === "ok" && "border-emerald-200 bg-emerald-50",
              ticket.tone === "prio" && "border-amber-300 bg-amber-50",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900">{ticket.id}</span>
              <span className="text-[9px] font-semibold uppercase text-neutral-500">
                {ticket.status}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-600">{ticket.items}</p>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

export function InventoryMock() {
  return (
    <MockChrome title="Stock">
      <div className="space-y-2">
        {[
          { name: "Mozzarella", qty: "12 kg", low: false },
          { name: "Tomato sauce", qty: "3 L", low: true },
          { name: "Flour 00", qty: "28 kg", low: false },
          { name: "Olive oil", qty: "1.5 L", low: true },
        ].map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
          >
            <span className="text-xs font-medium text-neutral-800">{row.name}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                row.low ? "bg-[#E31E24]/10 text-[#E31E24]" : "bg-emerald-100 text-emerald-700",
              )}
            >
              {row.qty}
            </span>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

export function StaffMock() {
  return (
    <MockChrome title="Staff · PIN">
      <div className="grid grid-cols-2 gap-2">
        {["Anna", "Mark", "Lira", "Admin"].map((name, i) => (
          <div
            key={name}
            className={cn(
              "rounded-xl border px-3 py-3 text-center",
              i === 0
                ? "border-[#E31E24]/40 bg-[#FFF5F5]"
                : "border-neutral-200 bg-neutral-50",
            )}
          >
            <div
              className={cn(
                "mx-auto flex size-8 items-center justify-center rounded-full text-xs font-bold",
                i === 0 ? "bg-[#E31E24] text-white" : "bg-neutral-200 text-neutral-600",
              )}
            >
              {name[0]}
            </div>
            <p className="mt-1.5 text-xs font-semibold text-neutral-800">{name}</p>
            <p className="text-[10px] text-neutral-400">{i === 3 ? "Owner" : "Waiter"}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {["1", "2", "3", "4", "5", "6"].map((d) => (
          <div
            key={d}
            className="rounded-md border border-neutral-200 bg-white py-1.5 text-center text-xs font-semibold text-neutral-700"
          >
            {d}
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

export function ReportsMock() {
  return (
    <MockChrome title="Reports · Analytics">
      <div className="flex items-end gap-1.5 h-24">
        {[40, 65, 48, 80, 55, 92, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              height: `${h}%`,
              backgroundColor: i === 5 ? "#E31E24" : "#FEE2E2",
            }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Today", "€1,240"],
          ["Z-Report", "Ready"],
          ["Export", "CSV"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-2">
            <p className="text-[9px] font-semibold uppercase text-neutral-400">{k}</p>
            <p className="mt-0.5 text-xs font-bold text-neutral-900">{v}</p>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

export function EnterpriseMock() {
  return (
    <MockChrome title="Enterprise · Central">
      <div className="space-y-2">
        {[
          { loc: "Downtown", sales: "€4.2k", status: "Live" },
          { loc: "Airport", sales: "€6.8k", status: "Live" },
          { loc: "Mall", sales: "€3.1k", status: "Live" },
        ].map((row) => (
          <div
            key={row.loc}
            className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5"
          >
            <div>
              <p className="text-xs font-semibold text-neutral-900">{row.loc}</p>
              <p className="text-[10px] text-neutral-400">Multi-location</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-neutral-900">{row.sales}</p>
              <p className="text-[10px] font-semibold text-emerald-600">{row.status}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-dashed border-[#E31E24]/30 bg-[#FFF5F5] px-3 py-2 text-center text-[11px] font-semibold text-[#E31E24]">
        Supply · Recipes · Custom reports
      </div>
    </MockChrome>
  );
}

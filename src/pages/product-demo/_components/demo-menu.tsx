import { useState } from "react";
import { Switch } from "@/components/ui/switch.tsx";
import { DEMO_CATEGORIES, DEMO_MENU_ITEMS, type DemoMenuItem } from "../_data.ts";

export default function DemoMenu() {
  const [items, setItems] = useState<DemoMenuItem[]>(DEMO_MENU_ITEMS);

  const toggle = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, available: !i.available } : i)));
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {DEMO_CATEGORIES.map((category) => (
        <div key={category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8b93a7]">
            {category}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items
              .filter((item) => item.category === category)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-[#1e2a45] bg-[#131A2E] px-3 py-2.5"
                >
                  <span className="text-xl">{item.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-[#8b93a7]">${item.price.toFixed(2)}</p>
                  </div>
                  <Switch checked={item.available} onCheckedChange={() => toggle(item.id)} />
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

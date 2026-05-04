import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { CATEGORY_ICON_PICKER } from "@/lib/pos-category-icons.ts";

const CATEGORY_COLORS = [
  "#F4A0B7",
  "#0066FF",
  "#44CC00",
  "#FF6B00",
  "#FF3366",
  "#9945FF",
  "#00C2FF",
  "#FFB800",
];

type CategoryData = {
  _id: Id<"menuCategories">;
  name: string;
  color: string;
  icon?: string;
  isActive: boolean;
};

type CategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  editing?: CategoryData | null;
  onSaved?: (category: CategoryData, mode: "create" | "update") => void;
};

export default function CategoryDialog({
  open,
  onOpenChange,
  licenseKey,
  editing,
  onSaved,
}: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(CATEGORY_ICON_PICKER[0].emoji);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const createCategory = useMutation('pos.menu.createCategory');
  const updateCategory = useMutation('pos.menu.updateCategory');

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setColor(editing.color);
        setIcon(editing.icon ?? CATEGORY_ICON_PICKER[0].emoji);
        setIsActive(editing.isActive);
      } else {
        setName("");
        setColor(CATEGORY_COLORS[0]);
        setIcon(CATEGORY_ICON_PICKER[0].emoji);
        setIsActive(true);
      }
    }
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateCategory({
          licenseKey,
          categoryId: editing._id,
          name: name.trim(),
          color,
          icon,
          isActive,
        });
        const updatedCategory: CategoryData = {
          _id: editing._id,
          name: name.trim(),
          color,
          icon,
          isActive,
        };
        const cached =
          (await getDataCache<CategoryData[]>(`categories:${licenseKey}`)) ?? [];
        await saveDataCache(
          `categories:${licenseKey}`,
          cached.map((c) =>
            c._id === editing._id
              ? updatedCategory
              : c,
          ),
        );
        onSaved?.(updatedCategory, "update");
        toast.success("Category updated");
      } else {
        const createdId = await createCategory({
          licenseKey,
          name: name.trim(),
          color,
          icon,
        });
        const cached =
          (await getDataCache<CategoryData[]>(`categories:${licenseKey}`)) ?? [];
        const newCategory: CategoryData = {
          _id: createdId as Id<"menuCategories">,
          name: name.trim(),
          color,
          icon,
          isActive: true,
        };
        await saveDataCache(`categories:${licenseKey}`, [...cached, newCategory]);
        onSaved?.(newCategory, "create");
        toast.success("Category created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 border-slate-200 bg-white p-0 text-slate-900 sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900">
            {editing ? "Edit Category" : "New Category"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label className="text-slate-600">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pizza, Beverages"
              className="border-slate-200 bg-slate-50 text-slate-900"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600">Icon</Label>
            <div className="grid max-h-[260px] grid-cols-8 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 pr-1 sm:grid-cols-10">
              {CATEGORY_ICON_PICKER.map((item) => (
                <button
                  key={item.emoji}
                  type="button"
                  onClick={() => setIcon(item.emoji)}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all cursor-pointer",
                    icon === item.emoji
                      ? "bg-[#0066FF]/10 ring-2 ring-[#0066FF] scale-105"
                      : "bg-white hover:bg-slate-100 border border-slate-200"
                  )}
                  title={item.label}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600">Color</Label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-9 h-9 rounded-lg transition-all cursor-pointer",
                    color === c
                      ? "ring-2 ring-[#0066FF] ring-offset-2 ring-offset-white scale-110"
                      : "opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {editing && (
            <div className="flex items-center justify-between">
              <Label className="text-slate-600">Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-500"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-[#0066FF] to-[#22c55e] text-white hover:opacity-95"
          >
            {editing ? "Save Changes" : "Add Category"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

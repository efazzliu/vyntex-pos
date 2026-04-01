import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

const CATEGORY_COLORS = [
  "#0066FF",
  "#44CC00",
  "#FF6B00",
  "#FF3366",
  "#9945FF",
  "#00C2FF",
  "#FF45B0",
  "#FFB800",
];

type CategoryData = {
  _id: Id<"menuCategories">;
  name: string;
  color: string;
  isActive: boolean;
};

type CategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  editing?: CategoryData | null;
};

export default function CategoryDialog({
  open,
  onOpenChange,
  licenseKey,
  editing,
}: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const createCategory = useMutation(api.pos.menu.createCategory);
  const updateCategory = useMutation(api.pos.menu.updateCategory);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setColor(editing.color);
        setIsActive(editing.isActive);
      } else {
        setName("");
        setColor(CATEGORY_COLORS[0]);
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
          isActive,
        });
        toast.success("Category updated");
      } else {
        await createCategory({
          licenseKey,
          name: name.trim(),
          color,
        });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] text-white">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Category" : "New Category"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Appetizers, Drinks"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Color</Label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-9 h-9 rounded-lg transition-all cursor-pointer",
                    color === c
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#131A2E] scale-110"
                      : "opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {editing && (
            <div className="flex items-center justify-between">
              <Label className="text-[#8b93a7]">Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#8b93a7]"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {editing ? "Save Changes" : "Add Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";

type ItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  categoryId: Id<"menuCategories">;
  editing?: Doc<"menuItems"> | null;
};

export default function ItemDialog({
  open,
  onOpenChange,
  licenseKey,
  categoryId,
  editing,
}: ItemDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  const createItem = useMutation(api.pos.menu.createItem);
  const updateItem = useMutation(api.pos.menu.updateItem);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setDescription(editing.description ?? "");
        setPrice(editing.price.toString());
        setAvailable(editing.available);
      } else {
        setName("");
        setDescription("");
        setPrice("");
        setAvailable(true);
      }
    }
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter an item name");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateItem({
          licenseKey,
          itemId: editing._id,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          available,
          categoryId,
        });
        toast.success("Item updated");
      } else {
        await createItem({
          licenseKey,
          categoryId,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
        });
        toast.success("Item created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] text-white">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Item" : "New Item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Caesar Salad"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description..."
              rows={2}
              className="bg-[#0A0F1E] border-[#1e2a45] text-white resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Price ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
            />
          </div>

          {editing && (
            <div className="flex items-center justify-between">
              <Label className="text-[#8b93a7]">Available</Label>
              <Switch checked={available} onCheckedChange={setAvailable} />
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
            {editing ? "Save Changes" : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import type { TableShape, TableStatus } from "../_lib/types.ts";

type TableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  zones: string[];
  editing?: Doc<"tables"> | null;
};

const SHAPE_OPTIONS: { value: TableShape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "rectangle", label: "Rectangle" },
];

export default function TableDialog({
  open,
  onOpenChange,
  licenseKey,
  zones,
  editing,
}: TableDialogProps) {
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("4");
  const [zone, setZone] = useState("");
  const [newZone, setNewZone] = useState("");
  const [shape, setShape] = useState<TableShape>("square");
  const [status, setStatus] = useState<TableStatus>("available");
  const [saving, setSaving] = useState(false);

  const createTable = useMutation('pos.tables.createTable');
  const updateTable = useMutation('pos.tables.updateTable');

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setSeats(editing.seats.toString());
        setZone(editing.zone);
        setNewZone("");
        setShape((editing.shape ?? "square") as TableShape);
        setStatus(editing.status as TableStatus);
      } else {
        setName("");
        setSeats("4");
        setZone(zones[0] ?? "__new");
        setNewZone(zones.length === 0 ? "Main Floor" : "");
        setShape("square");
        setStatus("available");
      }
    }
  }, [editing, open, zones]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a table name");
      return;
    }
    const seatsNum = parseInt(seats);
    if (isNaN(seatsNum) || seatsNum < 1) {
      toast.error("Please enter a valid number of seats");
      return;
    }
    const finalZone = zone === "__new" ? newZone.trim() : zone;
    if (!finalZone) {
      toast.error("Please select or enter a zone");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateTable({
          licenseKey,
          tableId: editing._id,
          name: name.trim(),
          seats: seatsNum,
          zone: finalZone,
          status,
          shape,
        });
        toast.success("Table updated");
      } else {
        await createTable({
          licenseKey,
          name: name.trim(),
          seats: seatsNum,
          zone: finalZone,
          shape,
        });
        toast.success("Table added to floor plan");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to save table");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] text-white">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Table" : "New Table"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Table 1, VIP, Bar Seat"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
            />
          </div>

          {/* Seats */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Seats</Label>
            <Input
              type="number"
              min="1"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
            />
          </div>

          {/* Shape */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Shape</Label>
            <div className="flex gap-2">
              {SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setShape(opt.value)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer",
                    shape === opt.value
                      ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                      : "border-[#1e2a45] bg-[#0A0F1E] text-[#8b93a7] hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Zone */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">Zone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="bg-[#0A0F1E] border-[#1e2a45] text-white">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
                <SelectItem value="__new">+ New Zone</SelectItem>
              </SelectContent>
            </Select>
            {zone === "__new" && (
              <Input
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                placeholder="Enter zone name"
                className="mt-2 bg-[#0A0F1E] border-[#1e2a45] text-white"
              />
            )}
          </div>

          {/* Status (only when editing) */}
          {editing && (
            <div className="space-y-2">
              <Label className="text-[#8b93a7]">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TableStatus)}
              >
                <SelectTrigger className="bg-[#0A0F1E] border-[#1e2a45] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="bill-printed">Bill Printed</SelectItem>
                </SelectContent>
              </Select>
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
            {editing ? "Save Changes" : "Add Table"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

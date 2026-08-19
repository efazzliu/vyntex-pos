import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { cn } from "@/lib/utils.ts";
import {
  defaultSelectionsForGroups,
  newCustomizationGroupId,
  newCustomizationOptionId,
  resolvedMenuItemUnitPrice,
  toggleCustomizationSelection,
  validateCustomizationSelections,
  type MenuCustomizationGroup,
  type MenuCustomizationOption,
  type SelectedCustomization,
} from "@/lib/menu-customizations.ts";
import { Plus, Trash2 } from "lucide-react";

type Props = {
  groups: MenuCustomizationGroup[];
  basePrice: number;
  formatPrice: (n: number) => string;
  accentClassName?: string;
  accentStyle?: React.CSSProperties;
  labels: {
    title: string;
    optionalNote: string;
    notePlaceholder: string;
    requiredError: string;
    confirm: string;
    cancel: string;
  };
  onConfirm: (selections: SelectedCustomization[], notes?: string) => void;
  onCancel: () => void;
};

export default function MenuItemCustomizationPicker({
  groups,
  basePrice,
  formatPrice,
  accentClassName,
  accentStyle,
  labels,
  onConfirm,
  onCancel,
}: Props) {
  const [selections, setSelections] = useState<SelectedCustomization[]>(() =>
    defaultSelectionsForGroups(groups),
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelections(defaultSelectionsForGroups(groups));
    setNotes("");
    setError(null);
  }, [groups]);

  const unitPrice = useMemo(
    () => resolvedMenuItemUnitPrice(basePrice, selections),
    [basePrice, selections],
  );

  const pickOption = (group: MenuCustomizationGroup, option: MenuCustomizationOption) => {
    setSelections((prev) => toggleCustomizationSelection(groups, prev, group, option));
    setError(null);
  };

  const handleConfirm = () => {
    const missing = validateCustomizationSelections(groups, selections);
    if (missing) {
      setError(`${labels.requiredError}: ${missing}`);
      return;
    }
    onConfirm(selections, notes.trim() || undefined);
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">{group.name}</Label>
            {group.required ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-amber-500">
                *
              </span>
            ) : null}
            {group.selectionType === "multi" ? (
              <span className="text-[10px] text-muted-foreground">multi</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const active = selections.some(
                (s) => s.groupId === group.id && s.optionId === option.id,
              );
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => pickOption(group, option)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? accentClassName ?? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                  )}
                  style={active ? accentStyle : undefined}
                >
                  {option.name}
                  {option.priceDelta ? ` (+${formatPrice(option.priceDelta)})` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <Label className="text-sm">{labels.optionalNote}</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={labels.notePlaceholder}
        />
      </div>

      {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-sm font-semibold tabular-nums">{formatPrice(unitPrice)}</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {labels.cancel}
          </Button>
          <Button type="button" onClick={handleConfirm}>
            {labels.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}

type EditorProps = {
  groups: MenuCustomizationGroup[];
  onChange: (groups: MenuCustomizationGroup[]) => void;
  labels: {
    title: string;
    addGroup: string;
    groupName: string;
    required: string;
    multi: string;
    addOption: string;
    optionName: string;
    priceDelta: string;
    defaultOption: string;
  };
};

export function MenuItemCustomizationEditor({
  groups,
  onChange,
  labels,
}: EditorProps) {
  const addGroup = () => {
    onChange([
      ...groups,
      {
        id: newCustomizationGroupId(),
        name: "",
        required: false,
        selectionType: "single",
        options: [
          {
            id: newCustomizationOptionId(),
            name: "",
            priceDelta: 0,
          },
        ],
      },
    ]);
  };

  const updateGroup = (groupId: string, patch: Partial<MenuCustomizationGroup>) => {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  };

  const removeGroup = (groupId: string) => {
    onChange(groups.filter((g) => g.id !== groupId));
  };

  const addOption = (groupId: string) => {
    onChange(
      groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: [
                ...g.options,
                { id: newCustomizationOptionId(), name: "", priceDelta: 0 },
              ],
            }
          : g,
      ),
    );
  };

  const updateOption = (
    groupId: string,
    optionId: string,
    patch: Partial<MenuCustomizationOption>,
  ) => {
    onChange(
      groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.map((o) =>
                o.id === optionId ? { ...o, ...patch } : o,
              ),
            }
          : g,
      ),
    );
  };

  const removeOption = (groupId: string, optionId: string) => {
    onChange(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.filter((o) => o.id !== optionId) }
          : g,
      ),
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-slate-700">{labels.title}</Label>
        <Button type="button" size="sm" variant="outline" onClick={addGroup}>
          <Plus className="mr-1 size-3.5" />
          {labels.addGroup}
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-slate-500">
          P.sh. Pjekja: Shumë / Mesatarisht / Pak · Sallatë: Me sallatë / Pa sallatë
        </p>
      ) : null}

      {groups.map((group) => (
        <div key={group.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start gap-2">
            <Input
              value={group.name}
              onChange={(e) => updateGroup(group.id, { name: e.target.value })}
              placeholder={labels.groupName}
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => removeGroup(group.id)}
              aria-label="Remove group"
            >
              <Trash2 className="size-4 text-red-500" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <Switch
                checked={Boolean(group.required)}
                onCheckedChange={(checked) => updateGroup(group.id, { required: checked })}
              />
              {labels.required}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <Switch
                checked={group.selectionType === "multi"}
                onCheckedChange={(checked) =>
                  updateGroup(group.id, { selectionType: checked ? "multi" : "single" })
                }
              />
              {labels.multi}
            </label>
          </div>
          <div className="space-y-2">
            {group.options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <Input
                  value={option.name}
                  onChange={(e) => updateOption(group.id, option.id, { name: e.target.value })}
                  placeholder={labels.optionName}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={option.priceDelta ?? 0}
                  onChange={(e) =>
                    updateOption(group.id, option.id, {
                      priceDelta: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder={labels.priceDelta}
                  className="w-24"
                />
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <Switch
                    checked={Boolean(option.isDefault)}
                    onCheckedChange={(checked) =>
                      updateOption(group.id, option.id, { isDefault: checked })
                    }
                  />
                  {labels.defaultOption}
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeOption(group.id, option.id)}
                  disabled={group.options.length <= 1}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => addOption(group.id)}>
              <Plus className="mr-1 size-3.5" />
              {labels.addOption}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

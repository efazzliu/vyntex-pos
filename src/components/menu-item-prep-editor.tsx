import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Plus, Trash2 } from "lucide-react";
import {
  newPrepId,
  type PrepChoiceGroup,
  type PrepConfig,
  type PrepOption,
} from "@/lib/menu-prep-config.ts";

type Labels = {
  title: string;
  hint: string;
  choiceTitle: string;
  choiceHint: string;
  addChoiceGroup: string;
  groupName: string;
  addOption: string;
  optionName: string;
  togglesTitle: string;
  togglesHint: string;
  toggleGroupName: string;
  addToggle: string;
  paidExtrasTitle: string;
  paidExtrasHint: string;
  addPaidExtra: string;
  priceDelta: string;
  allowCustomInstructions: string;
  allowCustomInstructionsHint: string;
  quickTitle: string;
  quickHint: string;
  addQuick: string;
};

type Props = {
  config: PrepConfig;
  onChange: (config: PrepConfig) => void;
  labels: Labels;
};

function OptionList({
  options,
  placeholder,
  addLabel,
  onChange,
  onAdd,
  priceLabel,
}: {
  options: PrepOption[];
  placeholder: string;
  addLabel: string;
  onChange: (options: PrepOption[]) => void;
  onAdd: () => void;
  priceLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <div key={option.id} className="flex items-center gap-2">
          <Input
            value={option.name}
            onChange={(e) =>
              onChange(
                options.map((o) =>
                  o.id === option.id ? { ...o, name: e.target.value } : o,
                ),
              )
            }
            placeholder={placeholder}
            className="flex-1"
          />
          {priceLabel ? (
            <div className="relative w-24 shrink-0">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={option.priceDelta || ""}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  onChange(
                    options.map((o) =>
                      o.id === option.id
                        ? {
                            ...o,
                            priceDelta:
                              Number.isFinite(value) && value > 0 ? value : 0,
                          }
                        : o,
                    ),
                  );
                }}
                placeholder="0.00"
                aria-label={`${option.name || placeholder} ${priceLabel}`}
                className="pr-7 text-right"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                €
              </span>
            </div>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onChange(options.filter((o) => o.id !== option.id))}
            aria-label="Remove"
          >
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={onAdd}>
        <Plus className="mr-1 size-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

export function MenuItemPrepEditor({ config, onChange, labels }: Props) {
  const addChoiceGroup = () => {
    onChange({
      ...config,
      choiceGroups: [
        ...config.choiceGroups,
        {
          id: newPrepId(),
          name: "",
          options: [{ id: newPrepId(), name: "" }],
        },
      ],
    });
  };

  const updateGroup = (groupId: string, patch: Partial<PrepChoiceGroup>) => {
    onChange({
      ...config,
      choiceGroups: config.choiceGroups.map((g) =>
        g.id === groupId ? { ...g, ...patch } : g,
      ),
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div>
        <Label className="text-slate-700">{labels.title}</Label>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{labels.hint}</p>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">{labels.choiceTitle}</p>
            <p className="text-[11px] text-slate-500">{labels.choiceHint}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addChoiceGroup}>
            <Plus className="mr-1 size-3.5" />
            {labels.addChoiceGroup}
          </Button>
        </div>
        {config.choiceGroups.map((group) => (
          <div key={group.id} className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
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
                onClick={() =>
                  onChange({
                    ...config,
                    choiceGroups: config.choiceGroups.filter((g) => g.id !== group.id),
                  })
                }
                aria-label="Remove group"
              >
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
            <OptionList
              options={group.options}
              placeholder={labels.optionName}
              addLabel={labels.addOption}
              onChange={(options) => updateGroup(group.id, { options })}
              onAdd={() =>
                updateGroup(group.id, {
                  options: [...group.options, { id: newPrepId(), name: "" }],
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-800">{labels.togglesTitle}</p>
        <p className="text-[11px] text-slate-500">{labels.togglesHint}</p>
        <Input
          value={config.toggleGroupName ?? ""}
          onChange={(e) => onChange({ ...config, toggleGroupName: e.target.value })}
          placeholder={labels.toggleGroupName}
        />
        <OptionList
          options={config.toggles}
          placeholder={labels.optionName}
          addLabel={labels.addToggle}
          onChange={(toggles) => onChange({ ...config, toggles })}
          onAdd={() =>
            onChange({
              ...config,
              toggles: [...config.toggles, { id: newPrepId(), name: "" }],
            })
          }
        />
      </div>

      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
        <p className="text-sm font-semibold text-slate-800">
          {labels.paidExtrasTitle}
        </p>
        <p className="text-[11px] text-slate-500">{labels.paidExtrasHint}</p>
        <OptionList
          options={config.paidExtras}
          placeholder={labels.optionName}
          addLabel={labels.addPaidExtra}
          priceLabel={labels.priceDelta}
          onChange={(paidExtras) => onChange({ ...config, paidExtras })}
          onAdd={() =>
            onChange({
              ...config,
              paidExtras: [
                ...config.paidExtras,
                { id: newPrepId(), name: "", priceDelta: 0 },
              ],
            })
          }
        />
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-800">{labels.quickTitle}</p>
        <p className="text-[11px] text-slate-500">{labels.quickHint}</p>
        <OptionList
          options={config.quickNotes}
          placeholder={labels.optionName}
          addLabel={labels.addQuick}
          priceLabel={labels.priceDelta}
          onChange={(quickNotes) => onChange({ ...config, quickNotes })}
          onAdd={() =>
            onChange({
              ...config,
              quickNotes: [...config.quickNotes, { id: newPrepId(), name: "" }],
            })
          }
        />
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {labels.allowCustomInstructions}
            </p>
            <p className="text-[11px] text-slate-500">
              {labels.allowCustomInstructionsHint}
            </p>
          </div>
          <Switch
            checked={config.allowWaiterCustomInstructions}
            onCheckedChange={(allowWaiterCustomInstructions) =>
              onChange({ ...config, allowWaiterCustomInstructions })
            }
          />
        </div>
      </div>
    </div>
  );
}

import type { PrepConfig } from "@/lib/menu-prep-config.ts";

/** Default kitchen/bar prep options when the item has no admin config. */
export function fallbackPrepConfig(t: (key: string) => string): PrepConfig {
  const chip = (id: string, key: string) => ({ id, name: t(key) });
  return {
    choiceGroups: [
      {
        id: "cooking",
        name: t("phone.waiter.order.prepCookingTitle"),
        options: [
          chip("well-done", "phone.waiter.order.notePresetWellDone"),
          chip("light", "phone.waiter.order.notePresetLight"),
          chip("medium", "phone.waiter.order.notePresetMedium"),
        ],
      },
    ],
    toggles: [
      chip("no-mushrooms", "phone.waiter.order.notePresetNoMushrooms"),
      chip("no-onions", "phone.waiter.order.notePresetNoOnions"),
      chip("no-veggies", "phone.waiter.order.notePresetNoVeggies"),
      chip("no-cheese", "phone.waiter.order.notePresetNoCheese"),
      chip("allergy", "phone.waiter.order.notePresetAllergy"),
    ],
    paidExtras: [],
    allowWaiterCustomInstructions: true,
    quickNotes: [
      {
        ...chip("with-sauce", "phone.waiter.order.notePresetWithSauce"),
        priceDelta: 0.5,
      },
      {
        ...chip("extra-spicy", "phone.waiter.order.notePresetExtraSpicy"),
        priceDelta: 0.5,
      },
    ],
  };
}

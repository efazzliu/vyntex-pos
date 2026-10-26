import { useEffect, useState } from "react";
import {
  getWaiterMenuSelection,
  subscribeWaiterMenuSelection,
  type WaiterMenuSelectionLine,
} from "@/phone-app/lib/waiter-menu-selection.ts";

export function useWaiterMenuSelection(): WaiterMenuSelectionLine[] {
  const [lines, setLines] = useState<WaiterMenuSelectionLine[]>(() =>
    getWaiterMenuSelection(),
  );
  useEffect(() => subscribeWaiterMenuSelection(() => setLines(getWaiterMenuSelection())), []);
  return lines;
}

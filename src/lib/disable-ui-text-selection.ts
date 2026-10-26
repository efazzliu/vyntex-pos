function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable=''], [contenteditable='true']",
    ),
  );
}

/** Stops click-drag from highlighting labels across POS / phone UI. */
export function attachUiTextSelectionGuard(): () => void {
  const onSelectStart = (event: Event) => {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
  };
  const onDragStart = (event: DragEvent) => {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
  };
  document.addEventListener("selectstart", onSelectStart, { capture: true });
  document.addEventListener("dragstart", onDragStart, { capture: true });
  return () => {
    document.removeEventListener("selectstart", onSelectStart, true);
    document.removeEventListener("dragstart", onDragStart, true);
  };
}

export function setPosSoftwareClass(enabled: boolean) {
  document.documentElement.classList.toggle("pos-software", enabled);
}

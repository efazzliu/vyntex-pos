import { useEffect, useRef } from "react";

/** Horizontal chip row: swipe on phone, drag on desktop, no native scrollbar. */
export function useFingerScroll() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) < 4) return;
      moved = true;
      el.scrollLeft = startScroll - dx;
      e.preventDefault();
    };
    const onUp = () => {
      if (dragging && moved) {
        const blockClick = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
          el.removeEventListener("click", blockClick, true);
        };
        el.addEventListener("click", blockClick, true);
      }
      dragging = false;
      moved = false;
    };

    el.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("pointermove", onMove, { capture: true, passive: false });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      el.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, []);
  return ref;
}

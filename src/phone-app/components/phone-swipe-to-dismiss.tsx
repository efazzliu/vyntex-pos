import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const DISMISS_DISTANCE = 104;

type Props = {
  onDismiss: () => void;
  label: string;
  className?: string;
  children: ReactNode;
};

/** Swipe a card to the right to remove it, like a phone notification. */
export default function PhoneSwipeToDismiss({
  onDismiss,
  label,
  className,
  children,
}: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef<"none" | "horizontal" | "vertical">("none");
  const [offset, setOffset] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const reset = () => {
    start.current = null;
    locked.current = "none";
    setOffset(0);
  };

  const handleStart = (x: number, y: number) => {
    if (leaving) return;
    start.current = { x, y };
    locked.current = "none";
  };

  const handleMove = (x: number, y: number) => {
    const origin = start.current;
    if (!origin || leaving) return;
    const dx = x - origin.x;
    const dy = y - origin.y;

    if (locked.current === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      locked.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (locked.current !== "horizontal") return;

    setOffset(Math.max(0, dx));
  };

  const handleEnd = () => {
    if (leaving) return;
    if (offset >= DISMISS_DISTANCE) {
      setLeaving(true);
      window.setTimeout(onDismiss, 180);
      return;
    }
    reset();
  };

  const progress = Math.min(1, offset / DISMISS_DISTANCE);

  return (
    <div className={cn("relative touch-pan-y", className)}>
      {offset > 0 || leaving ? (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center rounded-2xl bg-white/[0.06] pl-4"
          style={{ opacity: leaving ? 1 : progress }}
        >
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white/70">
            <Trash2 className="size-4" />
            {label}
          </span>
        </div>
      ) : null}

      <div
        onTouchStart={(e) =>
          handleStart(e.touches[0].clientX, e.touches[0].clientY)
        }
        onTouchMove={(e) =>
          handleMove(e.touches[0].clientX, e.touches[0].clientY)
        }
        onTouchEnd={handleEnd}
        onTouchCancel={reset}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") return;
          handleStart(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "touch" || start.current === null) return;
          handleMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "touch") return;
          handleEnd();
        }}
        onPointerCancel={reset}
        className="relative"
        style={{
          transform: `translateX(${leaving ? "110%" : `${offset}px`})`,
          opacity: leaving ? 0 : 1,
          transition:
            start.current && !leaving
              ? "none"
              : "transform 180ms ease-out, opacity 180ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}

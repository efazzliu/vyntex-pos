/**
 * Real national flag icons (official Wikimedia SVGs in /public/flags).
 * Windows renders flag emojis (🇺🇸 🇦🇱) as plain letters, so language
 * pickers use these image assets instead.
 */
import { cn } from "@/lib/utils.ts";

function FlagImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={20}
      height={14}
      decoding="async"
      className={cn(
        "h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-sm ring-1 ring-black/10",
        className,
      )}
    />
  );
}

export function FlagUS({ className }: { className?: string }) {
  return <FlagImg src="/flags/us.svg" alt="United States" className={className} />;
}

export function FlagAL({ className }: { className?: string }) {
  return <FlagImg src="/flags/al.svg" alt="Albania" className={className} />;
}

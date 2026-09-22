import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-xl border border-white/5 bg-white/[0.08]", className)}
      aria-hidden
    />
  );
}

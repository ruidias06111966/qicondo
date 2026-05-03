import { Link } from "@tanstack/react-router";

export function Logo({ size = "md", inverse = false }: { size?: "sm" | "md" | "lg"; inverse?: boolean }) {
  const dims = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-11 w-11 text-base" : "h-9 w-9 text-sm";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <span
        className={`${dims} flex items-center justify-center rounded-[10px] bg-primary text-primary-foreground font-display font-extrabold tracking-tight shadow-[var(--shadow-soft)] group-hover:scale-[1.03] transition-transform`}
      >
        CZ
      </span>
      <span
        className={`font-display font-extrabold tracking-tight ${text} ${inverse ? "text-white" : "text-foreground"}`}
      >
        CONDOZAP
      </span>
    </Link>
  );
}

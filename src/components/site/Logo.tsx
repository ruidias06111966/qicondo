import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/whatscond-logo.png";

export function Logo({ size = "md", inverse = false }: { size?: "sm" | "md" | "lg"; inverse?: boolean }) {
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <Link to="/" className="flex items-center gap-2.5 group" aria-label="QiDomínio">
      <span
        className={`${dims} flex items-center justify-center rounded-[10px] bg-primary-soft p-1 shadow-[var(--shadow-soft)] group-hover:scale-[1.03] transition-transform`}
      >
        <img
          src={logoMark}
          alt="QiDomínio"
          width={44}
          height={44}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </span>
      <span
        className={`font-display font-extrabold tracking-tight ${text} ${inverse ? "text-white" : "text-foreground"}`}
      >
        QiDomínio
      </span>
    </Link>
  );
}

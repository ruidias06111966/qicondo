import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/qicond-mark.png";

export function Logo({
  size = "md",
  inverse = false,
}: {
  size?: "sm" | "md" | "lg";
  inverse?: boolean;
}) {
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <Link to="/" className="flex items-center gap-2.5 group" aria-label="QiCond">
      {/* A marca traz o seu próprio quadrado verde arredondado. O invólucro
          que havia aqui — fundo `primary-soft` com recuo — desenhava um
          segundo quadrado à volta do primeiro. */}
      <img
        src={logoMark}
        alt="QiCond"
        width={44}
        height={44}
        className={`${dims} object-contain group-hover:scale-[1.03] transition-transform`}
      />
      <span
        className={`font-display font-extrabold tracking-tight ${text} ${inverse ? "text-white" : "text-foreground"}`}
      >
        QiCond
      </span>
    </Link>
  );
}

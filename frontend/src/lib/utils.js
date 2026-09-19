import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos (la ultima gana). */
export function cn(...entradas) {
  return twMerge(clsx(entradas));
}

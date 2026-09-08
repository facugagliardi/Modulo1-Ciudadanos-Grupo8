import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("rounded border border-borde bg-superficie", className)}
      {...props}
    />
  );
}

export function CardEncabezado({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-u2 border-b border-borde px-u3 py-u2",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitulo({ className, ...props }) {
  return <h2 className={cn("text-base font-semibold text-tinta", className)} {...props} />;
}

export function CardCuerpo({ className, ...props }) {
  return <div className={cn("px-u3 py-u3", className)} {...props} />;
}

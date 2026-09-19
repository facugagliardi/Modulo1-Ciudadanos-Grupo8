import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const estilos = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium " +
    "cursor-pointer select-none " +
    // El hundido al presionar es la respuesta más barata que existe: confirma
    // que el click llegó antes de que la red conteste nada.
    "transition-[colors,transform] duration-150 active:scale-[0.98] " +
    "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 " +
    "[&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        primario: "bg-expediente text-white hover:bg-[#16324f]",
        secundario: "border border-borde-fuerte bg-superficie text-tinta hover:bg-papel",
        fantasma: "text-expediente hover:bg-expediente-suave",
        // Reservado para lo que no vuelve atras. Ver DISENO.md.
        destructivo: "bg-sello text-white hover:bg-[#942b19]",
      },
      tamano: {
        normal: "h-control px-4 text-[length:var(--texto-dato)]",
        chico: "h-8 px-3 text-sm",
        icono: "h-control w-control p-0",
      },
    },
    defaultVariants: { variante: "primario", tamano: "normal" },
  },
);

export const Button = forwardRef(function Button(
  { className, variante, tamano, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp ref={ref} className={cn(estilos({ variante, tamano }), className)} {...props} />
  );
});

export { estilos as estilosDeBoton };

import * as Primitiva from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Pestanias = Primitiva.Root;

export function ListaPestanias({ className, ...props }) {
  return (
    <Primitiva.List
      className={cn("-mb-px flex gap-u3 overflow-x-auto border-b border-borde", className)}
      {...props}
    />
  );
}

export function Pestania({ className, ...props }) {
  return (
    <Primitiva.Trigger
      className={cn(
        "whitespace-nowrap border-b-2 border-transparent px-0.5 py-2.5 text-[length:var(--texto-dato)] text-apagado",
        "transition-colors duration-150 hover:text-tinta",
        "data-[state=active]:border-expediente data-[state=active]:font-semibold data-[state=active]:text-expediente",
        className,
      )}
      {...props}
    />
  );
}

export function PanelPestania({ className, ...props }) {
  return <Primitiva.Content className={cn("pt-u3", className)} {...props} />;
}

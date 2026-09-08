import { cn } from "@/lib/utils";

/**
 * La marca del municipio.
 *
 * El sello cuadrado con las iniciales no es decoración: es la forma que tiene
 * un sello de goma en un expediente, que es el mundo del que sale todo este
 * módulo. Se repite como motivo en los estados terminales.
 */
export function Marca({ className, compacta = false }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-[3px] bg-expediente font-mono text-[11px] font-semibold leading-none tracking-tight text-white"
      >
        CU
      </span>
      {!compacta && (
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-tinta">Ciudad UADE</span>
          <span className="text-[11px] text-apagado">Ciudadanos y expedientes</span>
        </span>
      )}
    </span>
  );
}

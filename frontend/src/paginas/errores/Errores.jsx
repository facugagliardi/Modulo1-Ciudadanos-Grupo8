import { Link, useLocation } from "react-router-dom";
import { Construction, ShieldOff } from "lucide-react";
import { useSesion } from "@/lib/auth/SesionContext";
import { etiquetaRol } from "@/lib/auth/permisos";
import { Button } from "@/componentes/ui/button";
import { Encabezado } from "@/componentes/Encabezado";

/**
 * Un 403 tiene que decir qué faltó, no sólo que no se pudo. El backend ya lo
 * hace así en sus mensajes ("Tu rol (X) no tiene permiso para Y"), y la
 * pantalla mantiene el mismo criterio.
 */
export function SinPermiso() {
  const { rol } = useSesion();
  const permiso = useLocation().state?.permiso;

  return (
    <div className="mx-auto max-w-lg py-u5 text-center">
      <ShieldOff className="mx-auto mb-u2 size-8 text-sello" aria-hidden="true" />
      <h1 className="mb-1">No tenés acceso a esta sección</h1>
      <p className="text-apagado">
        Tu rol es <strong className="text-tinta">{etiquetaRol(rol)}</strong>, y esta pantalla
        pide un permiso que no incluye
        {permiso && (
          <>
            {" "}
            (<code className="identificador text-[0.9em]">{permiso}</code>)
          </>
        )}
        . Si creés que deberías poder entrar, pedíselo a un responsable de área.
      </p>
      <Button asChild variante="secundario" className="mt-u3">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}

export function NoEncontrado() {
  return (
    <div className="mx-auto max-w-lg py-u5 text-center">
      <p className="identificador mb-u2 text-4xl font-semibold text-borde-fuerte">404</p>
      <h1 className="mb-1">Esta página no existe</h1>
      <p className="text-apagado">
        Puede que el enlace esté mal escrito o que el trámite se haya movido de lugar.
      </p>
      <Button asChild variante="secundario" className="mt-u3">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}

/**
 * Marcador para las secciones que están en el mapa pero todavía no se
 * construyeron. Es preferible decirlo a dejar un enlace que rompe.
 */
export function EnConstruccion({ seccion, titulo, descripcion }) {
  return (
    <>
      <Encabezado seccion={seccion} titulo={titulo} descripcion={descripcion} />
      <div className="flex flex-col items-center gap-u2 rounded border border-dashed border-borde-fuerte bg-superficie py-u5 text-center">
        <Construction className="size-6 text-apagado" aria-hidden="true" />
        <p className="font-medium text-tinta">Esta sección todavía no está construida</p>
        <p className="max-w-prose text-sm text-apagado">
          Está especificada en <code className="identificador">sitemap.md</code>, con sus
          pantallas, endpoints y permisos. Es la próxima tanda de trabajo.
        </p>
      </div>
    </>
  );
}

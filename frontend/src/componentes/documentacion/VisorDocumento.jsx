import { useEffect, useState } from "react";
import { ExternalLink, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { obtenerArchivoDocumento } from "@/lib/api/endpoints/documentacion";
import { mensajeAmable } from "@/lib/api/cliente";
import { CargaConEsqueleto, Hueso } from "@/componentes/Esqueleto";
import { Button } from "@/componentes/ui/button";

/**
 * Muestra el archivo de un documento, sea lo que sea que hayan subido.
 *
 * Hasta ahora el archivo no se podía ver: la base guarda un
 * `file:///C:/.../documento-1-v1.pdf`, que es una ruta del disco del servidor,
 * y no había endpoint que devolviera el binario. El empleado que tenía que
 * validar un documento aprobaba o rechazaba **a ciegas**.
 *
 * Dos detalles que definen cómo está hecho:
 *
 * 1. El archivo se pide con `fetch` y no se le pasa la URL al `<img>`. Un
 *    `<img src>` o un `<iframe src>` no mandan el header `Authorization`, así
 *    que la petición saldría sin token y el backend contestaría 401. Se trae el
 *    binario autenticado, se arma un `blob:` URL y ese sí lo entiende el
 *    elemento.
 *
 * 2. El tipo lo decide `blob.type`, que viene del `Content-Type` que mandó el
 *    backend, y no la extensión del nombre. El nombre lo eligió quien subió el
 *    archivo; el content-type lo pone el servidor a partir de la lista blanca.
 */
/** Los renglones de la hoja del esqueleto, con el corte desparejo de un texto. */
const ANCHOS_DE_RENGLON = ["w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-3/5", "w-full", "w-5/6"];

export function VisorDocumento({ documentoId, className }) {
  const [estado, setEstado] = useState({ cargando: true, url: null, tipo: null, error: null });

  useEffect(() => {
    const control = new AbortController();
    let url = null;
    let vigente = true;

    setEstado({ cargando: true, url: null, tipo: null, error: null });

    obtenerArchivoDocumento(documentoId, control.signal)
      .then((blob) => {
        if (!vigente) return;
        url = URL.createObjectURL(blob);
        setEstado({ cargando: false, url, tipo: blob.type, error: null });
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        if (vigente) setEstado({ cargando: false, url: null, tipo: null, error });
      });

    return () => {
      vigente = false;
      control.abort();
      // Sin esto el binario queda retenido en memoria hasta que se recargue la
      // pestaña: abrir diez documentos serían diez archivos sin liberar.
      if (url) URL.revokeObjectURL(url);
    };
  }, [documentoId]);

  const marco = cn(
    "flex min-h-[20rem] items-center justify-center overflow-hidden rounded border border-borde bg-papel",
    className,
  );

  /* Mientras se baja el archivo, el marco en cuadraditos con una hoja adentro:
     el título y unos renglones, la forma de un documento. */
  return (
    <CargaConEsqueleto
      cargando={estado.cargando}
      etiqueta="Abriendo el documento…"
      className={className}
      molde={
        <div className={cn(marco, "flex-col items-stretch justify-start gap-3 p-u4")}>
          <Hueso className="mb-2 h-5 w-2/5" />
          {ANCHOS_DE_RENGLON.map((ancho, i) => (
            <Hueso key={i} className={cn("h-3", ancho)} />
          ))}
        </div>
      }
    >
      {!estado.cargando && resultado()}
    </CargaConEsqueleto>
  );

  function resultado() {
    if (estado.error) {
      return (
        <div className={cn(marco, "flex-col gap-u2 p-u3 text-center")}>
          <FileWarning className="size-8 text-apagado" aria-hidden="true" />
          <p role="alert" className="text-[length:var(--texto-dato)]">
            {estado.error.status === 404
              ? "El archivo de este documento ya no está en el servidor."
              : mensajeAmable(estado.error)}
          </p>
        </div>
      );
    }

    if (estado.tipo === "application/pdf") {
      return (
        <iframe
          src={estado.url}
          title="Documento"
          className={cn(marco, "block h-full w-full border-borde")}
        />
      );
    }

    if (estado.tipo?.startsWith("image/")) {
      return (
        <div className={marco}>
          <img
            src={estado.url}
            alt="Documento cargado por el titular"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    // No debería pasar: el backend sólo acepta PDF e imágenes. Pero si algún día
    // se amplía la lista blanca y nadie toca esta pantalla, mejor ofrecer una
    // salida que mostrar un cuadro vacío.
    return (
      <div className={cn(marco, "flex-col gap-u2 p-u3 text-center")}>
        <FileWarning className="size-8 text-apagado" aria-hidden="true" />
        <p className="text-[length:var(--texto-dato)]">
          No podemos mostrar este tipo de archivo acá.
        </p>
        <Button asChild variante="secundario" tamano="chico">
          <a href={estado.url} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            Abrirlo en otra pestaña
          </a>
        </Button>
      </div>
    );
  }
}

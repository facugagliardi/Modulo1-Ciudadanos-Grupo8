import { useCallback } from "react";
import { Upload } from "lucide-react";
import { listarDocumentos } from "@/lib/api/endpoints/ciudadanos";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { ErrorEnPantalla } from "@/componentes/Estados";
import { ConEsqueleto } from "@/componentes/Esqueleto";
import { Encabezado } from "@/componentes/Encabezado";
import { ListaDocumentos, SubirDocumento } from "@/componentes/documentacion/ListaDocumentos";
import { Button } from "@/componentes/ui/button";

/**
 * La documentación del titular.
 *
 * El vecino sube y versiona; validar es del municipio. Por eso acá no hay
 * ninguna acción de validación aunque la ciudadano sea la dueña del documento.
 */
export function MisDocumentos() {
  const { id } = useSesion();
  const documentos = useRecurso(useCallback((s) => listarDocumentos(id, s), [id]));

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Mis documentos"
        descripcion="Lo que cargaste en el municipio. Un empleado los revisa y los valida."
        acciones={
          <SubirDocumento ciudadanoId={id} alGuardar={() => documentos.recargar()}>
            <Button>
              <Upload aria-hidden="true" />
              Subir documento
            </Button>
          </SubirDocumento>
        }
      />

      {documentos.error && (
        <ErrorEnPantalla error={documentos.error} alReintentar={documentos.recargar} />
      )}

      <ConEsqueleto
        recurso={documentos}
        clave={`documentos:${id}`}
        ejemplo={[]}
        etiqueta="Cargando tus documentos…"
      >
        {(lista) => (
          <ListaDocumentos
            ciudadanoId={id}
            documentos={lista}
            puedeSubir
            alCambiar={() => documentos.recargar()}
            vacio={{
              titulo: "Todavía no subiste ningún documento",
              descripcion:
                "Acá van tu DNI, certificados y todo lo que el municipio te vaya pidiendo para tus trámites.",
            }}
          />
        )}
      </ConEsqueleto>
    </>
  );
}

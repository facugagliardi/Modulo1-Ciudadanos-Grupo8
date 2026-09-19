import { useCallback } from "react";
import { Upload } from "lucide-react";
import { listarDocumentos } from "@/lib/api/endpoints/personas";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { Cargando, ErrorEnPantalla } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { ListaDocumentos, SubirDocumento } from "@/componentes/documentacion/ListaDocumentos";
import { Button } from "@/componentes/ui/button";

/**
 * La documentación del titular.
 *
 * El vecino sube y versiona; validar es del municipio. Por eso acá no hay
 * ninguna acción de validación aunque la persona sea la dueña del documento.
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
          <SubirDocumento personaId={id} alGuardar={() => documentos.recargar()}>
            <Button>
              <Upload aria-hidden="true" />
              Subir documento
            </Button>
          </SubirDocumento>
        }
      />

      {documentos.cargando && <Cargando />}
      {documentos.error && (
        <ErrorEnPantalla error={documentos.error} alReintentar={documentos.recargar} />
      )}

      {documentos.datos && (
        <ListaDocumentos
          personaId={id}
          documentos={documentos.datos}
          puedeSubir
          alCambiar={() => documentos.recargar()}
          vacio={{
            titulo: "Todavía no subiste ningún documento",
            descripcion:
              "Acá van tu DNI, certificados y todo lo que el municipio te vaya pidiendo para tus trámites.",
          }}
        />
      )}
    </>
  );
}

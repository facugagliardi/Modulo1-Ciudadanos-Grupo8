import { ErrorEnPantalla } from "./Estados";
import { ConEsqueleto } from "./Esqueleto";
import { Card, CardCuerpo } from "./ui/card";
import { formatearFecha } from "@/lib/dominio/formato";

const ESTADOS = {
  REGISTERED: "Registrado", IN_REVIEW: "En revisión", ROUTED: "Derivado", IN_PROGRESS: "En gestión",
  PENDING_INFORMATION: "Esperando información", DUPLICATE: "Vinculado a otro reclamo", RESOLVED: "Resuelto",
  CLOSED: "Cerrado", CANCELLED: "Cancelado", REQUESTED: "Solicitado", APPROVED: "Aprobado",
  GRANTED: "Otorgado", REJECTED: "Rechazado",
};
const TIPOS = { TICKET: "Atención ciudadana", EXENCION: "Exención de Rentas", PLAN_PAGO: "Plan de pago de Rentas" };

export function SeguimientoExterno({ recurso, ciudadanoId }) {
  return (
    <section className="mt-u3" aria-label="Seguimiento de otros módulos">
      {recurso.error && <ErrorEnPantalla error={recurso.error} alReintentar={recurso.recargar} />}
      <ConEsqueleto recurso={recurso} clave={`tramites-externos:${ciudadanoId}`} ejemplo={[]}>
        {(lista) => lista.length > 0 && (
          <>
            <h2 className="mb-u2">Seguimiento de otros módulos</h2>
            <p className="mb-u2 text-sm text-apagado">Última información recibida de Atención Ciudadana y Rentas. Las gestiones se realizan en el módulo correspondiente.</p>
            <ul className="flex flex-col gap-u2">
              {lista.map((tramite) => (
                <li key={`${tramite.sourceModule}:${tramite.tipo}:${tramite.externalId}`}>
                  <Card><CardCuerpo>
                    <p className="text-sm text-apagado">{TIPOS[tramite.tipo] ?? "Trámite"} · {tramite.datos.publicId ?? tramite.externalId}</p>
                    <h3 className="font-medium">{tramite.datos.summary ?? tramite.datos.conceptCode ?? TIPOS[tramite.tipo] ?? "Trámite"}</h3>
                    <p>Estado informado: {ESTADOS[tramite.estado] ?? "Actualizado"}</p>
                    {tramite.datos.publicMessage && <p className="mt-u1">{tramite.datos.publicMessage}</p>}
                    {tramite.datos.reason && <p className="mt-u1">{tramite.datos.reason}</p>}
                    <p className="mt-u1 text-sm text-apagado">Actualizado el {formatearFecha(tramite.actualizadoEn)}</p>
                  </CardCuerpo></Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </ConEsqueleto>
    </section>
  );
}

import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ENTIDADES, esTerminal } from "@/lib/dominio/estados";
import { formatearFechaHora, nombreCompleto } from "@/lib/dominio/formato";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Identificador } from "@/componentes/Identificador";

/**
 * La carátula del expediente.
 *
 * Es la única superficie del sistema que se sale del formato de tarjeta, y la
 * única donde aparece la serif. Un expediente municipal *es* una carátula: una
 * hoja con un número único, un asunto escrito arriba, el área que lo inició y
 * el titular. Reproducir esa forma no es nostalgia — es lo que hace que un
 * empleado de mesa de entradas reconozca al instante qué está mirando.
 *
 * El resto del sistema queda deliberadamente callado para que esto destaque.
 */
export function Caratula({ expediente, titular, enlaceTitular, acciones }) {
  const terminal = esTerminal(ENTIDADES.EXPEDIENTE, expediente.estado);

  return (
    <article className="overflow-hidden rounded border border-borde-fuerte bg-superficie">
      {/* Banda superior: el número, que es lo que la gente dicta por teléfono */}
      <header className="flex flex-wrap items-center justify-between gap-u2 border-b border-borde-fuerte bg-papel px-u3 py-u2">
        <p className="flex flex-wrap items-baseline gap-x-u2 gap-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-apagado">
            Expediente
          </span>
          <Identificador valor={expediente.numero} className="text-lg font-semibold" />
        </p>
        <span className={cn(terminal && "sello-entra")}>
          <BadgeEstado entidad={ENTIDADES.EXPEDIENTE} estado={expediente.estado} />
        </span>
      </header>

      <div className="px-u3 py-u4">
        {/* El asunto, escrito en la tapa */}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-apagado">
          Carátula
        </p>
        <h1 className="caratula max-w-3xl text-balance text-3xl font-medium leading-snug text-tinta">
          {expediente.caratula}
        </h1>

        <dl className="mt-u4 grid gap-u3 border-t border-borde pt-u3 sm:grid-cols-2 lg:grid-cols-4">
          <CampoSellado etiqueta="Titular">
            {enlaceTitular ? (
              <Link to={enlaceTitular} className="font-medium text-expediente hover:underline">
                {titular ? nombreCompleto(titular) : `Persona #${expediente.personaId}`}
              </Link>
            ) : titular ? (
              nombreCompleto(titular)
            ) : (
              <Identificador valor={`#${expediente.personaId}`} />
            )}
          </CampoSellado>

          <CampoSellado etiqueta="Área iniciadora">{expediente.areaIniciadora}</CampoSellado>

          <CampoSellado etiqueta="Fecha de inicio">
            {formatearFechaHora(expediente.fechaInicio)}
          </CampoSellado>

          <CampoSellado etiqueta="Actuaciones">
            <span className="tabular">{expediente.actuacionesCount ?? 0}</span>
          </CampoSellado>
        </dl>

        {acciones && (
          <div className="mt-u3 flex flex-wrap items-center gap-u2 border-t border-borde pt-u3">
            {acciones}
          </div>
        )}
      </div>
    </article>
  );
}

function CampoSellado({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-apagado">{etiqueta}</dt>
      <dd className="mt-0.5 text-tinta">{children || <span className="text-apagado">—</span>}</dd>
    </div>
  );
}

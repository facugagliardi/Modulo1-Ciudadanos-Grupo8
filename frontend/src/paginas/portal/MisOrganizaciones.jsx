import { useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";
import { listarRepresentaciones } from "@/lib/api/endpoints/personas";
import { listarOrganizacionesDeDueno } from "@/lib/api/endpoints/organizaciones";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { formatearFecha } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { ALCANCES_REPRESENTACION, etiquetaDe } from "@/lib/dominio/listasBlancas";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { Button } from "@/componentes/ui/button";
import { Card, CardCuerpo } from "@/componentes/ui/card";

/**
 * Las organizaciones del titular.
 *
 * Hay dos vínculos distintos entre una persona y una organización, y la
 * pantalla necesita los dos:
 *
 *   - **Dueño**: titularidad. Es lo que deja el alta de una organización.
 *   - **Representante**: permiso para actuar en su nombre. Se otorga aparte.
 *
 * Antes esta pantalla sólo consultaba representaciones, y por eso una
 * organización recién registrada no aparecía nunca: el alta te hace dueño, no
 * representante. Se veía como "se perdió", pero nunca había estado.
 *
 * Las dos listas se unen por `organizacionId`, así una organización donde sos
 * las dos cosas aparece una sola vez con los dos rótulos.
 */
export function MisOrganizaciones() {
  const { id } = useSesion();

  const vinculos = useRecurso(
    useCallback(
      async (s) => {
        const [duenoDe, representaciones] = await Promise.all([
          listarOrganizacionesDeDueno(id, s),
          listarRepresentaciones(id, s),
        ]);
        return unir(duenoDe, representaciones);
      },
      [id],
    ),
  );

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Mis organizaciones"
        descripcion="Las que son tuyas y aquellas en las que podés actuar en su nombre."
        acciones={
          <Button asChild>
            <Link to="/portal/organizaciones/nueva">
              <Building2 aria-hidden="true" />
              Registrar una
            </Link>
          </Button>
        }
      />

      {vinculos.cargando && <Cargando />}
      {vinculos.error && (
        <ErrorEnPantalla error={vinculos.error} alReintentar={vinculos.recargar} />
      )}

      {vinculos.datos?.length === 0 && (
        <Card>
          <CardCuerpo>
            <EstadoVacio
              titulo="Todavía no tenés organizaciones"
              descripcion="Si sos dueño de una empresa o comercio, registralo acá. Si sos apoderado de una que ya existe, alguien de la organización tiene que otorgarte la representación."
              accion={
                <Button asChild variante="secundario">
                  <Link to="/portal/organizaciones/nueva">Registrar una organización</Link>
                </Button>
              }
            />
          </CardCuerpo>
        </Card>
      )}

      {vinculos.datos?.length > 0 && (
        <ul className="lista-escalonada flex flex-col gap-u2">
          {vinculos.datos.map((v) => (
            <li key={v.organizacionId}>
              <Card>
                <CardCuerpo>
                  <Link
                    to={`/portal/organizaciones/${v.organizacionId}`}
                    className="group flex flex-wrap items-start justify-between gap-u2"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-u2">
                        <span className="font-medium text-expediente group-hover:underline">
                          {v.razonSocial}
                        </span>
                        {v.esDueno && (
                          <span className="inline-flex items-center rounded bg-expediente-suave px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-expediente">
                            Dueño
                          </span>
                        )}
                        {v.representacion && (
                          <BadgeEstado
                            entidad={ENTIDADES.REPRESENTACION}
                            estado={v.representacion.estado}
                          />
                        )}
                      </span>
                      <span className="block text-[length:var(--texto-dato)] text-apagado">
                        {describir(v)}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-apagado transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-expediente"
                      aria-hidden="true"
                    />
                  </Link>
                </CardCuerpo>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Una fila por organización, aunque la persona tenga los dos vínculos.
 *
 * Los dueños van primero: es el vínculo más fuerte, y además es el que se
 * acaba de crear cuando alguien registra una organización y vuelve a esta
 * pantalla a buscarla.
 */
function unir(duenoDe, representaciones) {
  const porId = new Map();

  for (const o of duenoDe) {
    porId.set(o.organizacionId, {
      organizacionId: o.organizacionId,
      razonSocial: o.razonSocial,
      esDueno: true,
      porcentajeTitularidad: o.porcentajeTitularidad,
      representacion: null,
    });
  }

  for (const r of representaciones) {
    const yaEsta = porId.get(r.organizacionId);
    if (yaEsta) {
      yaEsta.representacion = r;
    } else {
      porId.set(r.organizacionId, {
        organizacionId: r.organizacionId,
        razonSocial: r.razonSocial,
        esDueno: false,
        porcentajeTitularidad: null,
        representacion: r,
      });
    }
  }

  return [...porId.values()].sort((a, b) => {
    if (a.esDueno !== b.esDueno) return a.esDueno ? -1 : 1;
    return (a.razonSocial ?? "").localeCompare(b.razonSocial ?? "", "es");
  });
}

/** La línea de abajo: qué sos en esta organización, en una frase. */
function describir(v) {
  const partes = [];

  if (v.esDueno) {
    partes.push(
      v.porcentajeTitularidad != null
        ? `Dueño del ${Number(Number(v.porcentajeTitularidad).toFixed(2))}%`
        : "Dueño",
    );
  }

  if (v.representacion) {
    const r = v.representacion;
    const alcance = etiquetaDe(ALCANCES_REPRESENTACION, r.alcance).toLowerCase();
    partes.push(
      `alcance ${alcance} desde el ${formatearFecha(r.desde)}` +
        (r.hasta ? ` hasta el ${formatearFecha(r.hasta)}` : ", sin vencimiento"),
    );
  }

  return partes.join(" · ");
}

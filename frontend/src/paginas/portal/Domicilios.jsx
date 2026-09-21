import { useCallback, useState } from "react";
import { MapPin, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  actualizarDomicilio,
  cerrarDomicilio,
  crearDomicilio,
  listarDomicilios,
  marcarDomicilioPrincipal,
} from "@/lib/api/endpoints/personas";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { mensajeAmable } from "@/lib/api/cliente";
import { formatearFecha } from "@/lib/dominio/formato";
import { etiquetaDe, TIPOS_PROPIEDAD } from "@/lib/dominio/listasBlancas";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { ConfirmarAccion } from "@/componentes/ConfirmarAccion";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

/**
 * Los domicilios del titular, con su historia.
 *
 * La regla de negocio es que un domicilio no se modifica: se cierra el vigente
 * y se abre uno nuevo. La pantalla la hace evidente en lugar de esconderla —
 * por eso los cerrados siguen a la vista, en gris, debajo del actual.
 */
export function Domicilios() {
  const { id } = useSesion();
  const domicilios = useRecurso(useCallback((s) => listarDomicilios(id, s), [id]));

  const lista = domicilios.datos ?? [];
  const vigentes = lista.filter((d) => !d.vigenteHasta);
  // El backend devuelve 409 al cerrar el único domicilio principal vigente.
  // Es preferible desactivar la acción y explicarlo que dejar que falle.
  const esElUnicoVigente = vigentes.length <= 1;

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Mis domicilios"
        descripcion="Podés tener varios. Uno es el principal y es el que usa el municipio para notificarte."
        acciones={
          <FormularioDomicilio
            personaId={id}
            sinDomiciliosAun={lista.length === 0}
            alGuardar={() => domicilios.recargar()}
            disparador={
              <Button>
                <Plus aria-hidden="true" />
                Agregar domicilio
              </Button>
            }
          />
        }
      />

      {domicilios.cargando && <Cargando />}
      {domicilios.error && (
        <ErrorEnPantalla error={domicilios.error} alReintentar={domicilios.recargar} />
      )}

      {domicilios.datos?.length === 0 && (
        <Card>
          <CardCuerpo>
            <EstadoVacio
              titulo="Todavía no cargaste ningún domicilio"
              descripcion="El municipio necesita saber dónde vivís para notificarte y para asignarte los servicios de tu zona."
              accion={
                <FormularioDomicilio
                  personaId={id}
                  sinDomiciliosAun
                  alGuardar={() => domicilios.recargar()}
                  disparador={<Button>Cargar mi domicilio</Button>}
                />
              }
            />
          </CardCuerpo>
        </Card>
      )}

      {lista.length > 0 && (
        // `aria-busy` mientras se recarga, pero sin sacar la lista de su lugar:
        // marcar el cambio de domicilio principal no tiene que mover la página.
        <ol
          aria-busy={domicilios.recargando || undefined}
          className={cn(
            "lista-escalonada flex flex-col transition-opacity duration-150",
            domicilios.recargando && "opacity-60",
          )}
        >
          {lista.map((d, i) => {
            const vigente = !d.vigenteHasta;
            return (
              <li
                key={d.propiedadId}
                className={cn(
                  "relative border-l-2 pb-u3 pl-u3",
                  vigente ? "border-expediente" : "border-borde",
                  i === lista.length - 1 && "border-transparent pb-0",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -left-[5px] top-4 size-2 rounded-full",
                    vigente ? "bg-expediente" : "bg-borde-fuerte",
                  )}
                />

                <Card className={cn(!vigente && "bg-transparent")}>
                  <CardCuerpo className="flex flex-wrap items-start justify-between gap-u2">
                    <div className={cn("flex min-w-0 gap-u2", !vigente && "opacity-70")}>
                      <MapPin className="mt-0.5 size-5 shrink-0 text-apagado" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {d.calle} {d.numero}
                          {d.altura ? `, ${d.altura}` : ""}
                          {d.esPrincipal && vigente && (
                            <span className="inline-flex items-center gap-1 rounded bg-expediente-suave px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-expediente">
                              <Star className="size-3" aria-hidden="true" />
                              Principal
                            </span>
                          )}
                        </p>
                        <p className="text-[length:var(--texto-dato)] text-apagado">
                          {etiquetaDe(TIPOS_PROPIEDAD, d.tipo)} ·{" "}
                          {vigente
                            ? `desde el ${formatearFecha(d.vigenteDesde)}`
                            : `del ${formatearFecha(d.vigenteDesde)} al ${formatearFecha(d.vigenteHasta)}`}
                        </p>
                      </div>
                    </div>

                    {vigente && (
                      <div className="flex flex-wrap items-center gap-u2">
                        {!d.esPrincipal && (
                          <Button
                            variante="secundario"
                            tamano="chico"
                            onClick={async () => {
                              await marcarDomicilioPrincipal(d.propiedadId);
                              domicilios.recargar();
                            }}
                          >
                            Hacer principal
                          </Button>
                        )}

                        <FormularioDomicilio
                          personaId={id}
                          domicilio={d}
                          alGuardar={() => domicilios.recargar()}
                          disparador={
                            <Button variante="secundario" tamano="chico">
                              Editar
                            </Button>
                          }
                        />

                        {esElUnicoVigente ? (
                          <p className="max-w-[16rem] text-sm text-apagado">
                            Es tu único domicilio vigente. Cargá otro antes de darlo de baja.
                          </p>
                        ) : (
                          <ConfirmarAccion
                            titulo="Dar de baja este domicilio"
                            descripcion="No se borra: queda en tu historial con la fecha de cierre, como exige el registro."
                            textoConfirmar="Dar de baja"
                            alConfirmar={async () => {
                              await cerrarDomicilio(d.propiedadId);
                              domicilios.recargar();
                            }}
                            disparador={
                              <Button variante="fantasma" tamano="chico">
                                Dar de baja
                              </Button>
                            }
                          />
                        )}
                      </div>
                    )}
                  </CardCuerpo>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

const VACIO = {
  tipo: "CASA",
  calle: "",
  numero: "",
  altura: "",
  longitud: "",
  latitud: "",
  esPrincipal: false,
};

/**
 * Alta y edición.
 *
 * Ojo con la asimetría del backend: el POST acepta `esPrincipal` y el PUT no.
 * Además el PUT **no es parcial**: pide tipo, calle y número sí o sí.
 */
function FormularioDomicilio({ personaId, domicilio, sinDomiciliosAun, disparador, alGuardar }) {
  const esEdicion = Boolean(domicilio);
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validar() {
    const e = {};
    if (!valores.calle.trim()) e.calle = "Ingresá la calle.";
    if (!valores.numero.trim()) e.numero = "Ingresá la altura.";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      if (esEdicion) await actualizarDomicilio(domicilio.propiedadId, valores);
      // El primer domicilio siempre es el principal: no tendría sentido otra cosa.
      else await crearDomicilio(personaId, { ...valores, esPrincipal: sinDomiciliosAun || valores.esPrincipal });
      alGuardar?.();
      setAbierto(false);
    } catch (error) {
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setValores(
            domicilio
              ? {
                  tipo: domicilio.tipo ?? "CASA",
                  calle: domicilio.calle ?? "",
                  numero: domicilio.numero ?? "",
                  altura: domicilio.altura ?? "",
                  longitud: domicilio.longitud ?? "",
                  latitud: domicilio.latitud ?? "",
                  esPrincipal: Boolean(domicilio.esPrincipal),
                }
              : VACIO,
          );
          setErrores({});
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>{disparador}</DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo={esEdicion ? "Editar domicilio" : "Agregar domicilio"}
        descripcion={
          esEdicion ? "Corregís los datos del domicilio vigente." : "¿Dónde vivís?"
        }
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          <Campo etiqueta="Tipo de vivienda" obligatorio>
            {(props) => (
              <Selector
                {...props}
                opciones={TIPOS_PROPIEDAD}
                value={valores.tipo}
                onChange={(e) => cambiar("tipo", e.target.value)}
              />
            )}
          </Campo>

          <div className="grid gap-u2 sm:grid-cols-[2fr_1fr_1fr]">
            <Campo
              etiqueta="Calle"
              obligatorio
              autoComplete="address-line1"
              value={valores.calle}
              onChange={(e) => cambiar("calle", e.target.value)}
              error={errores.calle}
            />
            <Campo
              etiqueta="Número"
              obligatorio
              inputMode="numeric"
              value={valores.numero}
              onChange={(e) => cambiar("numero", e.target.value)}
              error={errores.numero}
            />
            <Campo
              etiqueta="Piso y depto."
              ayuda="Opcional"
              value={valores.altura}
              onChange={(e) => cambiar("altura", e.target.value)}
              error={errores.altura}
            />
          </div>

          {!esEdicion && !sinDomiciliosAun && (
            <label className="flex cursor-pointer items-start gap-2 rounded border border-borde-fuerte p-3">
              <input
                type="checkbox"
                checked={valores.esPrincipal}
                onChange={(e) => cambiar("esPrincipal", e.target.checked)}
                className="mt-0.5 size-4 accent-[color:var(--expediente)]"
              />
              <span>
                <span className="font-medium text-tinta">Que sea mi domicilio principal</span>
                <span className="block text-sm text-apagado">
                  El que tenías como principal va a quedar en el historial.
                </span>
              </span>
            </label>
          )}

          {sinDomiciliosAun && !esEdicion && (
            <p className="text-sm text-apagado">
              Como es tu primer domicilio, queda como principal.
            </p>
          )}

          {errorGeneral && (
            <p
              role="alert"
              className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
            >
              {mensajeAmable(errorGeneral)}
            </p>
          )}

          <div className="mt-u1 flex justify-end gap-u2">
            <CerrarDialogo asChild>
              <Button type="button" variante="secundario">
                Cancelar
              </Button>
            </CerrarDialogo>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar domicilio"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}

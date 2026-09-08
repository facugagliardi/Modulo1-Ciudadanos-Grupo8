import { useCallback, useState } from "react";
import { Plus, Trash2, UserRound } from "lucide-react";
import {
  actualizarRelacion,
  cambiarResponsable,
  crearRelacion,
  eliminarRelacion,
  listarRelaciones,
} from "@/lib/api/endpoints/relaciones";
import { buscarPorDni } from "@/lib/api/endpoints/ciudadanos";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { etiquetaDe, reciprocoDe, TIPOS_RELACION } from "@/lib/dominio/listasBlancas";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { ConfirmarAccion } from "@/componentes/ConfirmarAccion";
import { Identificador } from "@/componentes/Identificador";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

/**
 * El grupo familiar del vecino.
 *
 * El vínculo se declara desde los dos extremos, porque así lo guarda el
 * backend: si vos sos el padre, la otra persona es el hijo. La pantalla pide
 * las dos puntas y propone la recíproca para que no haya que pensarla.
 *
 * Desarrollo Social consume estos vínculos para evaluar vulnerabilidad y
 * cupos, así que marcar quién es responsable de quién no es un detalle menor.
 */
export function Familia() {
  const { id } = useSesion();
  const relaciones = useRecurso(useCallback((s) => listarRelaciones(id, s), [id]));

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Mi grupo familiar"
        descripcion="Las personas con las que tenés un vínculo registrado en el municipio."
        acciones={
          <FormularioRelacion
            miId={id}
            alGuardar={() => relaciones.recargar()}
            disparador={
              <Button>
                <Plus aria-hidden="true" />
                Agregar vínculo
              </Button>
            }
          />
        }
      />

      {relaciones.cargando && <Cargando />}
      {relaciones.error && (
        <ErrorEnPantalla error={relaciones.error} alReintentar={relaciones.recargar} />
      )}

      {relaciones.datos?.length === 0 && (
        <Card>
          <CardCuerpo>
            <EstadoVacio
              titulo="No tenés vínculos cargados"
              descripcion="Registrar a tu familia sirve para los programas sociales y para que alguien pueda hacer trámites por vos."
              accion={
                <FormularioRelacion
                  miId={id}
                  alGuardar={() => relaciones.recargar()}
                  disparador={<Button>Agregar el primero</Button>}
                />
              }
            />
          </CardCuerpo>
        </Card>
      )}

      {relaciones.datos?.length > 0 && (
        <ul className="lista-escalonada flex flex-col gap-u2">
          {relaciones.datos.map((r) => (
            <li key={r.relacionId}>
              <Card>
                <CardCuerpo className="flex flex-wrap items-center justify-between gap-u2">
                  <div className="flex min-w-0 items-center gap-u2">
                    <span
                      aria-hidden="true"
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-expediente-suave text-expediente"
                    >
                      <UserRound className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {[r.nombre, r.apellido].filter(Boolean).join(" ") ||
                          `Vecino #${r.ciudadanoRelacionadoId}`}
                      </p>
                      <p className="text-[length:var(--texto-dato)] text-apagado">
                        {etiquetaDe(TIPOS_RELACION, r.tipoRelacion)}
                        {r.esResponsable && " · es responsable"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-u2">
                    <label className="flex cursor-pointer items-center gap-2 text-[length:var(--texto-dato)]">
                      <input
                        type="checkbox"
                        checked={Boolean(r.esResponsable)}
                        onChange={async (e) => {
                          await cambiarResponsable(r.relacionId, e.target.checked);
                          relaciones.recargar();
                        }}
                        className="size-4 accent-[color:var(--expediente)]"
                      />
                      Es responsable
                    </label>

                    <FormularioRelacion
                      miId={id}
                      relacion={r}
                      alGuardar={() => relaciones.recargar()}
                      disparador={
                        <Button variante="secundario" tamano="chico">
                          Editar
                        </Button>
                      }
                    />

                    <ConfirmarAccion
                      titulo="Eliminar este vínculo"
                      descripcion={`Se borra la relación con ${[r.nombre, r.apellido].filter(Boolean).join(" ")}. Los datos de esa persona no se tocan.`}
                      textoConfirmar="Eliminar vínculo"
                      alConfirmar={async () => {
                        await eliminarRelacion(r.relacionId);
                        relaciones.recargar();
                      }}
                      disparador={
                        <Button variante="fantasma" tamano="chico" aria-label="Eliminar vínculo">
                          <Trash2 aria-hidden="true" />
                        </Button>
                      }
                    />
                  </div>
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
 * Alta y edición de un vínculo.
 *
 * Para dar de alta hace falta el id de la otra persona, y la única forma de
 * conseguirlo es buscarla por DNI: `GET /ciudadanos/dni/{dni}` nunca devuelve
 * 404, responde `{existe:false}`. Por eso el alta tiene dos pasos.
 */
function FormularioRelacion({ miId, relacion, disparador, alGuardar }) {
  const esEdicion = Boolean(relacion);
  const [abierto, setAbierto] = useState(false);

  const [dni, setDni] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorDni, setErrorDni] = useState(null);
  const [otra, setOtra] = useState(null);

  const [yoSoy, setYoSoy] = useState("");
  const [elOtroEs, setElOtroEs] = useState("HIJO");
  const [errorYoSoy, setErrorYoSoy] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function reiniciar() {
    setDni("");
    setOtra(
      esEdicion
        ? {
            id: relacion.ciudadanoRelacionadoId,
            nombre: relacion.nombre,
            apellido: relacion.apellido,
          }
        : null,
    );
    setErrorDni(null);
    setErrorGeneral(null);
    setErrorYoSoy(null);
    const suyo = esEdicion ? relacion.tipoRelacion : "HIJO";
    setElOtroEs(suyo);
    // Queda vacío si no se puede deducir: es preferible preguntarlo.
    setYoSoy(reciprocoDe(suyo) ?? "");
  }

  async function buscar(evento) {
    evento.preventDefault();
    setErrorDni(null);
    setOtra(null);
    const limpio = soloDigitos(dni);
    if (limpio.length < 7 || limpio.length > 9) {
      setErrorDni("El DNI tiene entre 7 y 9 dígitos.");
      return;
    }
    setBuscando(true);
    try {
      const res = await buscarPorDni(limpio);
      if (!res?.existe) {
        setErrorDni("No encontramos a nadie con ese DNI. Esa persona tiene que registrarse primero.");
        return;
      }
      if (res.id === miId) {
        setErrorDni("Ese sos vos.");
        return;
      }
      setOtra({ id: res.id, nombre: res.nombre, apellido: res.apellido });
    } catch (e) {
      setErrorDni(mensajeAmable(e));
    } finally {
      setBuscando(false);
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!yoSoy) {
      setErrorYoSoy("Elegí qué sos vos de esta persona.");
      return;
    }
    setEnviando(true);
    try {
      if (esEdicion) {
        await actualizarRelacion(relacion.relacionId, {
          relacionCiudadano1: yoSoy,
          relacionCiudadano2: elOtroEs,
        });
      } else {
        await crearRelacion({
          ciudadanoId1: miId,
          ciudadanoId2: otra.id,
          relacionCiudadano1: yoSoy,
          relacionCiudadano2: elOtroEs,
          esResponsable: false,
        });
      }
      alGuardar?.();
      setAbierto(false);
    } catch (e) {
      setErrorGeneral(e);
    } finally {
      setEnviando(false);
    }
  }

  const nombreOtra = otra ? [otra.nombre, otra.apellido].filter(Boolean).join(" ") : "";

  return (
    <Dialogo
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) reiniciar();
      }}
    >
      <DisparadorDialogo asChild>{disparador}</DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo={esEdicion ? "Editar vínculo" : "Agregar vínculo familiar"}
        descripcion={
          esEdicion
            ? "Corregí cómo se relacionan."
            : "Buscá a la persona por su DNI. Tiene que estar registrada en el municipio."
        }
      >
        {!esEdicion && !otra && (
          <form onSubmit={buscar} noValidate className="flex flex-col gap-u2">
            <Campo
              etiqueta="DNI de la persona"
              obligatorio
              inputMode="numeric"
              ayuda="Sin puntos"
              value={dni}
              onChange={(e) => {
                setDni(e.target.value);
                setErrorDni(null);
              }}
              error={errorDni}
            />
            <div className="flex justify-end gap-u2">
              <CerrarDialogo asChild>
                <Button type="button" variante="secundario">
                  Cancelar
                </Button>
              </CerrarDialogo>
              <Button type="submit" disabled={buscando}>
                {buscando ? "Buscando…" : "Buscar"}
              </Button>
            </div>
          </form>
        )}

        {otra && (
          <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
            <div className="flex items-center justify-between gap-u2 rounded border border-borde bg-papel px-3 py-2">
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-apagado">
                  Persona
                </span>
                <span className="font-medium">{nombreOtra || `Vecino #${otra.id}`}</span>
              </span>
              {!esEdicion && (
                <Button
                  type="button"
                  variante="fantasma"
                  tamano="chico"
                  onClick={() => setOtra(null)}
                >
                  Cambiar
                </Button>
              )}
            </div>

            <Campo etiqueta={`¿Qué es ${nombreOtra || "esta persona"} tuyo?`} obligatorio>
              {(props) => (
                <Selector
                  {...props}
                  opciones={TIPOS_RELACION}
                  value={elOtroEs}
                  onChange={(e) => {
                    const v = e.target.value;
                    setElOtroEs(v);
                    // Sólo se propone cuando el vínculo lo determina. Para
                    // padre/madre o hermano/hermana hace falta un dato que la
                    // aplicación no tiene, así que se pregunta.
                    setYoSoy(reciprocoDe(v) ?? "");
                    setErrorYoSoy(null);
                  }}
                />
              )}
            </Campo>

            <Campo
              etiqueta={`¿Y vos qué sos de ${nombreOtra || "esta persona"}?`}
              obligatorio
              ayuda={
                reciprocoDe(elOtroEs)
                  ? "Lo completamos según lo anterior. Podés cambiarlo."
                  : "Este no lo podemos deducir del vínculo anterior."
              }
              error={errorYoSoy}
            >
              {(props) => (
                <Selector
                  {...props}
                  placeholder="Elegí una opción"
                  opciones={TIPOS_RELACION}
                  value={yoSoy}
                  onChange={(e) => {
                    setYoSoy(e.target.value);
                    setErrorYoSoy(null);
                  }}
                />
              )}
            </Campo>

            {errorGeneral && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
              >
                {errorGeneral.status === 409
                  ? "Ya existe un vínculo registrado con esa persona."
                  : mensajeAmable(errorGeneral)}
              </p>
            )}

            <div className="mt-u1 flex justify-end gap-u2">
              <CerrarDialogo asChild>
                <Button type="button" variante="secundario">
                  Cancelar
                </Button>
              </CerrarDialogo>
              <Button type="submit" disabled={enviando}>
                {enviando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar vínculo"}
              </Button>
            </div>
          </form>
        )}
      </ContenidoDialogo>
    </Dialogo>
  );
}

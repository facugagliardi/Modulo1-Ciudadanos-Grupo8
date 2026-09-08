import { useCallback, useState } from "react";
import { BadgeCheck, CircleDashed, Mail, Phone, Plus, Trash2 } from "lucide-react";
import {
  actualizarContacto,
  crearContacto,
  eliminarContacto,
  listarContactos,
  verificarContacto,
} from "@/lib/api/endpoints/contactos";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { mensajeAmable } from "@/lib/api/cliente";
import { Cargando, ErrorEnPantalla, EstadoVacio } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { ConfirmarAccion } from "@/componentes/ConfirmarAccion";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";
import { TIPOS_CONTACTO } from "@/lib/dominio/listasBlancas";

/**
 * Los datos de contacto del vecino.
 *
 * Es la única forma que tiene el municipio de avisarle algo, así que la
 * pantalla insiste cuando no hay ninguno cargado.
 *
 * El backend normaliza lo que recibe: el correo se guarda en minúsculas y el
 * teléfono sin espacios ni guiones. Por eso siempre se muestra lo que devolvió
 * la respuesta y no lo que escribió la persona.
 */

// Las mismas reglas que aplica el backend, para avisar antes de mandar.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO = /^\+?[0-9][0-9\s-]{7,19}$/;

export function Contactos() {
  const { id } = useSesion();
  const contactos = useRecurso(useCallback((s) => listarContactos(id, s), [id]));
  const [editando, setEditando] = useState(null);

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Mi contacto"
        descripcion="Por acá te avisamos del estado de tus trámites."
        acciones={
          <FormularioContacto
            personaId={id}
            alGuardar={() => contactos.recargar()}
            disparador={
              <Button>
                <Plus aria-hidden="true" />
                Agregar contacto
              </Button>
            }
          />
        }
      />

      {contactos.cargando && <Cargando />}
      {contactos.error && (
        <ErrorEnPantalla error={contactos.error} alReintentar={contactos.recargar} />
      )}

      {contactos.datos?.length === 0 && (
        <Card>
          <CardCuerpo>
            <EstadoVacio
              titulo="Todavía no cargaste ningún contacto"
              descripcion="Sin un correo o un teléfono no podemos avisarte cuando avanza un trámite tuyo."
              accion={
                <FormularioContacto
                  personaId={id}
                  alGuardar={() => contactos.recargar()}
                  disparador={<Button>Agregar el primero</Button>}
                />
              }
            />
          </CardCuerpo>
        </Card>
      )}

      {contactos.datos?.length > 0 && (
        <ul className="lista-escalonada flex flex-col gap-u2">
          {contactos.datos.map((c) => (
            <li key={c.contactoId}>
              <Card>
                <CardCuerpo className="flex flex-wrap items-center justify-between gap-u2">
                  <div className="flex min-w-0 items-center gap-u2">
                    {c.tipo === "EMAIL" ? (
                      <Mail className="size-5 shrink-0 text-apagado" aria-hidden="true" />
                    ) : (
                      <Phone className="size-5 shrink-0 text-apagado" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-apagado">
                        {c.tipo === "EMAIL" ? "Correo electrónico" : "Teléfono"}
                      </p>
                      <p className="identificador truncate">{c.valor}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-u2">
                    {c.verificado ? (
                      <span className="inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] font-medium text-vigente">
                        <BadgeCheck className="size-4" aria-hidden="true" />
                        Verificado
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado">
                          <CircleDashed className="size-4" aria-hidden="true" />
                          Sin verificar
                        </span>
                        <DialogoVerificar
                          contacto={c}
                          alVerificar={() => contactos.recargar()}
                        />
                      </>
                    )}

                    <FormularioContacto
                      personaId={id}
                      contacto={c}
                      abierto={editando === c.contactoId}
                      alCambiarApertura={(v) => setEditando(v ? c.contactoId : null)}
                      alGuardar={() => contactos.recargar()}
                      disparador={
                        <Button variante="secundario" tamano="chico">
                          Editar
                        </Button>
                      }
                    />

                    <ConfirmarAccion
                      titulo="Eliminar este contacto"
                      descripcion={`Vamos a borrar ${c.valor}. Si es el único que tenés, el municipio no va a poder avisarte nada.`}
                      textoConfirmar="Eliminar"
                      alConfirmar={async () => {
                        await eliminarContacto(c.contactoId);
                        contactos.recargar();
                      }}
                      disparador={
                        <Button variante="fantasma" tamano="chico" aria-label={`Eliminar ${c.valor}`}>
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

/** Alta y edición comparten formulario: el backend usa el mismo par de campos. */
function FormularioContacto({ personaId, contacto, disparador, alGuardar, abierto, alCambiarApertura }) {
  const esEdicion = Boolean(contacto);
  const [interno, setInterno] = useState(false);
  const visible = abierto ?? interno;
  const cambiarApertura = alCambiarApertura ?? setInterno;

  const [valores, setValores] = useState({
    tipo: contacto?.tipo ?? "EMAIL",
    valor: contacto?.valor ?? "",
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function validar() {
    const e = {};
    const v = valores.valor.trim();
    if (!v) e.valor = valores.tipo === "EMAIL" ? "Ingresá el correo." : "Ingresá el teléfono.";
    else if (valores.tipo === "EMAIL" && !REGEX_EMAIL.test(v)) e.valor = "Revisá el correo.";
    else if (valores.tipo === "TELEFONO" && !REGEX_TELEFONO.test(v)) {
      e.valor = "Ingresá entre 8 y 20 dígitos. Podés usar + al principio.";
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      if (esEdicion) await actualizarContacto(contacto.contactoId, valores);
      else await crearContacto(personaId, valores);
      alGuardar?.();
      cambiarApertura(false);
      if (!esEdicion) setValores({ tipo: "EMAIL", valor: "" });
    } catch (error) {
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      open={visible}
      onOpenChange={(v) => {
        cambiarApertura(v);
        if (v) {
          setValores({ tipo: contacto?.tipo ?? "EMAIL", valor: contacto?.valor ?? "" });
          setErrores({});
          setErrorGeneral(null);
        }
      }}
    >
      <DisparadorDialogo asChild>{disparador}</DisparadorDialogo>

      <ContenidoDialogo
        titulo={esEdicion ? "Editar contacto" : "Agregar contacto"}
        descripcion={
          esEdicion
            ? "Al cambiarlo va a quedar como no verificado otra vez."
            : "Podés cargar un correo o un teléfono."
        }
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          <Campo etiqueta="Tipo" obligatorio>
            {(props) => (
              <Selector
                {...props}
                opciones={TIPOS_CONTACTO}
                value={valores.tipo}
                onChange={(e) => {
                  setValores((v) => ({ ...v, tipo: e.target.value }));
                  setErrores({});
                }}
              />
            )}
          </Campo>

          <Campo
            etiqueta={valores.tipo === "EMAIL" ? "Correo electrónico" : "Teléfono"}
            obligatorio
            type={valores.tipo === "EMAIL" ? "email" : "tel"}
            inputMode={valores.tipo === "EMAIL" ? "email" : "tel"}
            ayuda={
              valores.tipo === "TELEFONO"
                ? "Con código de área. Ejemplo: +54 11 4444-5555"
                : undefined
            }
            value={valores.valor}
            onChange={(e) => {
              setValores((v) => ({ ...v, valor: e.target.value }));
              setErrores({});
            }}
            error={errores.valor}
          />

          {errorGeneral && (
            <p
              role="alert"
              className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
            >
              {errorGeneral.status === 409
                ? "Ya tenés ese contacto cargado."
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
              {enviando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar contacto"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}

function DialogoVerificar({ contacto, alVerificar }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!/^[0-9]{6}$/.test(codigo)) {
      setError("El código tiene 6 dígitos.");
      return;
    }
    setEnviando(true);
    try {
      await verificarContacto(contacto.contactoId, codigo);
      alVerificar?.();
      setAbierto(false);
      setCodigo("");
    } catch (e) {
      setErrorGeneral(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo open={abierto} onOpenChange={setAbierto}>
      <DisparadorDialogo asChild>
        <Button variante="secundario" tamano="chico">
          Verificar
        </Button>
      </DisparadorDialogo>

      <ContenidoDialogo
        titulo="Verificar contacto"
        descripcion={`Confirmá que ${contacto.valor} te pertenece.`}
      >
        <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
          <Campo
            etiqueta="Código de verificación"
            obligatorio
            inputMode="numeric"
            maxLength={6}
            // El backend todavía no emite ni guarda códigos: acepta cualquiera
            // de seis dígitos. Decirlo es preferible a simular un envío.
            ayuda="Seis dígitos. El envío de códigos todavía no está implementado en el sistema."
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value);
              setError(null);
            }}
            error={error}
          />

          {errorGeneral && (
            <p
              role="alert"
              className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
            >
              {errorGeneral.status === 409
                ? "Este contacto ya estaba verificado."
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
              {enviando ? "Verificando…" : "Verificar"}
            </Button>
          </div>
        </form>
      </ContenidoDialogo>
    </Dialogo>
  );
}

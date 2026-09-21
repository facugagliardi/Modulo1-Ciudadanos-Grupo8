import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { registrarPersona } from "@/lib/api/endpoints/auth";
import { buscarPorDni } from "@/lib/api/endpoints/ciudadanos";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Encabezado } from "@/componentes/Encabezado";
import { Identificador } from "@/componentes/Identificador";
import { Button } from "@/componentes/ui/button";
import { Campo } from "@/componentes/ui/campo";
import { CampoFecha, hoyISO } from "@/componentes/ui/fecha";
import { Card, CardCuerpo } from "@/componentes/ui/card";

/**
 * Alta asistida: un empleado registra a un vecino que vino al mostrador.
 *
 * DOS COSAS QUE DEFINEN ESTA PANTALLA:
 *
 * 1. **El DNI se chequea mientras se escribe.** `GET /ciudadanos/dni/{dni}`
 *    nunca devuelve 404: responde `{existe:false}`. Avisar antes de enviar
 *    evita el 409 y, sobre todo, evita el duplicado — que en un padrón es un
 *    problema mucho peor que un error de formulario.
 *
 * 2. **Hay que ponerle una contraseña al vecino.** El backend sólo tiene
 *    `POST /auth/register`, que la exige; no existe un alta sin credencial ni
 *    forma de enviársela (las notificaciones son del M9 y los eventos todavía
 *    no se publican). Así que la pantalla la genera, la muestra una vez y dice
 *    con todas las letras que hay que entregársela en mano. Ver issues.md,
 *    punto 15.
 */
export function AltaDeVecino() {
  const navegar = useNavigate();

  const [valores, setValores] = useState({
    dni: "",
    nombre: "",
    apellido: "",
    fechaNacimiento: "",
    cuit: "",
    password: generarClave(),
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [creado, setCreado] = useState(null);

  // Chequeo del DNI en vivo, con un respiro para no consultar en cada tecla.
  const [chequeo, setChequeo] = useState({ estado: "quieto" });
  const dniLimpio = soloDigitos(valores.dni);

  useEffect(() => {
    if (dniLimpio.length < 7 || dniLimpio.length > 9) {
      setChequeo({ estado: "quieto" });
      return undefined;
    }
    const control = new AbortController();
    setChequeo({ estado: "consultando" });
    const t = setTimeout(async () => {
      try {
        const res = await buscarPorDni(dniLimpio, control.signal);
        setChequeo(
          res?.existe ? { estado: "existe", persona: res } : { estado: "libre" },
        );
      } catch (e) {
        if (e?.name !== "AbortError") setChequeo({ estado: "quieto" });
      }
    }, 400);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [dniLimpio]);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validar() {
    const e = {};
    if (!dniLimpio) e.dni = "Ingresá el DNI.";
    else if (dniLimpio.length < 7 || dniLimpio.length > 9) e.dni = "El DNI tiene entre 7 y 9 dígitos.";
    if (!valores.nombre.trim()) e.nombre = "Ingresá el nombre.";
    if (!valores.apellido.trim()) e.apellido = "Ingresá el apellido.";
    if (!valores.fechaNacimiento) e.fechaNacimiento = "Ingresá la fecha de nacimiento.";
    else if (valores.fechaNacimiento >= new Date().toISOString().slice(0, 10)) {
      e.fechaNacimiento = "La fecha tiene que ser anterior a hoy.";
    }
    const cuil = soloDigitos(valores.cuit);
    if (!cuil) e.cuit = "Ingresá el CUIL.";
    else if (cuil.length !== 11) e.cuit = "El CUIL tiene 11 dígitos.";
    if (valores.password.length < 8) e.password = "Tiene que tener al menos 8 caracteres.";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      const persona = await registrarPersona({ ...valores, tipo: "CIUDADANO" });
      setCreado({ persona, password: valores.password });
    } catch (error) {
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  // --- Confirmación: la única vez que se ve la contraseña ---
  if (creado) {
    return (
      <>
        <Encabezado seccion="Padrón" titulo="Vecino registrado" />
        <Card className="max-w-2xl">
          <CardCuerpo className="flex flex-col gap-u3">
            <p className="flex items-center gap-2 text-lg font-medium text-vigente">
              <CheckCircle2 className="size-5" aria-hidden="true" />
              {creado.persona.nombre} {creado.persona.apellido} quedó en el padrón
            </p>

            <dl className="grid gap-u2 sm:grid-cols-3">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-apagado">Ficha</dt>
                <dd><Identificador valor={`#${creado.persona.personaId}`} /></dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-apagado">DNI</dt>
                <dd><Identificador valor={creado.persona.dni} tipo="dni" /></dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-apagado">CUIL</dt>
                <dd><Identificador valor={creado.persona.cuil} tipo="cuit" /></dd>
              </div>
            </dl>

            <div className="rounded border border-alerta bg-alerta-suave px-u3 py-u2">
              <p className="flex items-center gap-2 font-medium text-alerta">
                <KeyRound className="size-4" aria-hidden="true" />
                Entregale estos datos de acceso
              </p>
              <p className="mt-1 text-[length:var(--texto-dato)] text-alerta">
                El sistema no envía correos ni mensajes: la única forma de que el vecino los
                reciba es que se los des ahora. Esta contraseña no se vuelve a mostrar.
              </p>
              <dl className="mt-u2 grid gap-u2 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-alerta">Usuario (CUIL)</dt>
                  <dd className="identificador text-lg">{creado.persona.cuil}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-alerta">Contraseña provisoria</dt>
                  <dd className="identificador text-lg">{creado.password}</dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-wrap gap-u2">
              <Button asChild>
                <Link to={`/admin/padron/${creado.persona.personaId}`}>Ir a su legajo</Link>
              </Button>
              <Button
                variante="secundario"
                onClick={() => {
                  setCreado(null);
                  setValores({
                    dni: "", nombre: "", apellido: "", fechaNacimiento: "", cuit: "",
                    password: generarClave(),
                  });
                  setChequeo({ estado: "quieto" });
                }}
              >
                Registrar otro vecino
              </Button>
              <Button asChild variante="fantasma">
                <Link to="/admin/padron">Volver al padrón</Link>
              </Button>
            </div>
          </CardCuerpo>
        </Card>
      </>
    );
  }

  const duplicado = chequeo.estado === "existe";

  return (
    <>
      <Link
        to="/admin/padron"
        className="mb-u2 inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado hover:text-expediente"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al padrón
      </Link>

      <Encabezado
        seccion="Padrón"
        titulo="Registrar vecino"
        descripcion="Alta asistida para quien se acerca al mostrador. El domicilio y el contacto se cargan después, desde su legajo."
      />

      <Card className="max-w-2xl">
        <CardCuerpo>
          <form onSubmit={enviar} noValidate className="flex flex-col gap-u3">
            <div>
              <Campo
                etiqueta="DNI"
                obligatorio
                inputMode="numeric"
                autoFocus
                ayuda="Sin puntos. Lo verificamos contra el padrón mientras escribís."
                value={valores.dni}
                onChange={(e) => cambiar("dni", e.target.value)}
                error={errores.dni}
              />

              {chequeo.estado === "consultando" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-apagado">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Buscando en el padrón…
                </p>
              )}

              {chequeo.estado === "libre" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-vigente">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Ese DNI no está registrado. Podés continuar.
                </p>
              )}

              {duplicado && (
                <div
                  role="alert"
                  className="mt-u2 rounded border border-alerta bg-alerta-suave px-3 py-2"
                >
                  <p className="flex items-center gap-2 font-medium text-alerta">
                    <TriangleAlert className="size-4" aria-hidden="true" />
                    Ese DNI ya está en el padrón
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-u2 text-[length:var(--texto-dato)]">
                    <span className="font-medium">
                      {chequeo.persona.nombre} {chequeo.persona.apellido}
                    </span>
                    <BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={chequeo.persona.estado} />
                  </p>
                  <Button
                    asChild
                    variante="secundario"
                    tamano="chico"
                    className="mt-u2"
                  >
                    <Link to={`/admin/padron/${chequeo.persona.id}`}>Abrir su legajo</Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-u2 sm:grid-cols-2">
              <Campo
                etiqueta="Nombre"
                obligatorio
                value={valores.nombre}
                onChange={(e) => cambiar("nombre", e.target.value)}
                error={errores.nombre}
              />
              <Campo
                etiqueta="Apellido"
                obligatorio
                value={valores.apellido}
                onChange={(e) => cambiar("apellido", e.target.value)}
                error={errores.apellido}
              />
            </div>

            <div className="grid gap-u2 sm:grid-cols-2">
              <CampoFecha
                etiqueta="Fecha de nacimiento"
                obligatorio
                max={hoyISO()}
                value={valores.fechaNacimiento}
                onChange={(e) => cambiar("fechaNacimiento", e.target.value)}
                error={errores.fechaNacimiento}
              />
              <Campo
                etiqueta="CUIL"
                obligatorio
                inputMode="numeric"
                ayuda="Once dígitos."
                value={valores.cuit}
                onChange={(e) => cambiar("cuit", e.target.value)}
                error={errores.cuit}
              />
            </div>

            <Campo
              etiqueta="Contraseña provisoria"
              obligatorio
              ayuda="La generamos por vos. Se la vas a tener que entregar en mano: el sistema no envía correos."
              value={valores.password}
              onChange={(e) => cambiar("password", e.target.value)}
              error={errores.password}
            />

            {errorGeneral && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
              >
                {errorGeneral.status === 409
                  ? "Ya hay una persona registrada con ese DNI o CUIL."
                  : mensajeAmable(errorGeneral)}
              </p>
            )}

            <div className="flex flex-wrap gap-u2">
              <Button type="submit" disabled={enviando || duplicado}>
                {enviando ? "Registrando…" : "Registrar vecino"}
              </Button>
              <Button type="button" variante="secundario" onClick={() => navegar("/admin/padron")}>
                Cancelar
              </Button>
            </div>

            {duplicado && (
              <p className="text-sm text-apagado">
                No se puede registrar: ese DNI ya existe y en el padrón es único.
              </p>
            )}
          </form>
        </CardCuerpo>
      </Card>
    </>
  );
}

/**
 * Una contraseña provisoria legible.
 *
 * Alguien la va a dictar en un mostrador y otro alguien la va a tipear, así que
 * evita los caracteres que se confunden: ninguna sílaba lleva `l` (contra el
 * `1`) y el número arranca en 23, para que no aparezcan `0` ni `1`.
 */
export function generarClave() {
  const silabas = ["ma", "re", "ti", "so", "da", "pa", "ne", "ki", "ro", "va", "chu", "fe"];
  const al = (n) => Math.floor(Math.random() * n);
  const parte = () => silabas[al(silabas.length)];
  return `${parte()}${parte()}-${parte()}${23 + al(77)}`;
}

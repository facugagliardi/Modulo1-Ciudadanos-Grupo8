import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { buscarPorCuit, crearOrganizacion } from "@/lib/api/endpoints/organizaciones";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { TIPOS_ORGANIZACION } from "@/lib/dominio/listasBlancas";
import { BuscadorDePersona } from "@/componentes/BuscadorDePersona";
import { Encabezado } from "@/componentes/Encabezado";
import { Identificador } from "@/componentes/Identificador";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { CerrarDialogo, ContenidoDialogo, Dialogo, DisparadorDialogo } from "@/componentes/ui/dialog";

/**
 * Alta de organización. La misma pantalla en las dos zonas: el backend deja
 * crear organizaciones a cualquier usuario autenticado.
 *
 * El alta pide **al menos un dueño**, y cada dueño es un objeto
 * `{personaId, porcentajeTitularidad}` — no un id suelto, como dice mal
 * ARCHITECTURE.md.
 */
export function NuevaOrganizacion({ zona = "admin" }) {
  const navegar = useNavigate();
  const volverA = zona === "admin" ? "/admin/organizaciones" : "/portal/organizaciones";

  const [valores, setValores] = useState({
    cuit: "",
    razonSocial: "",
    nombreFantasia: "",
    tipo: "SRL",
  });
  const [duenos, setDuenos] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [avisoCuit, setAvisoCuit] = useState(null);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  /**
   * Chequeo del CUIT al salir del campo. El endpoint nunca da 404: responde
   * {existe:false}. Avisar acá evita mandar un alta que termina en 409.
   */
  async function revisarCuit() {
    const limpio = soloDigitos(valores.cuit);
    setAvisoCuit(null);
    if (limpio.length !== 11) return;
    try {
      const res = await buscarPorCuit(limpio);
      if (res?.existe) {
        setAvisoCuit(
          `Ya hay una organización con ese CUIT: ${res.razonSocial}.`,
        );
      }
    } catch {
      // Si la consulta falla no se bloquea el alta: el backend valida igual.
    }
  }

  const totalAsignado = duenos.reduce((t, d) => t + Number(d.porcentajeTitularidad ?? 0), 0);

  function validar() {
    const e = {};
    const cuit = soloDigitos(valores.cuit);
    if (!cuit) e.cuit = "Ingresá el CUIT.";
    else if (cuit.length !== 11) e.cuit = "El CUIT tiene 11 dígitos.";
    if (!valores.razonSocial.trim()) e.razonSocial = "Ingresá la razón social.";
    if (duenos.length === 0) e.duenos = "Agregá al menos un dueño.";
    if (totalAsignado > 100) e.duenos = "La suma de titularidades no puede pasar de 100%.";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      const creada = await crearOrganizacion({
        ...valores,
        duenos: duenos.map((d) => ({
          personaId: d.personaId,
          porcentajeTitularidad: d.porcentajeTitularidad ?? undefined,
        })),
      });
      navegar(`${volverA}/${creada.organizacionId}`, { replace: true });
    } catch (error) {
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Link
        to={volverA}
        className="mb-u2 inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado hover:text-expediente"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a organizaciones
      </Link>

      <Encabezado
        seccion={zona === "admin" ? "Gestión interna" : "Portal del vecino"}
        titulo="Registrar organización"
        descripcion="Empresas, comercios, asociaciones civiles, cooperativas e instituciones."
      />

      <Card className="max-w-2xl">
        <CardCuerpo>
          <form onSubmit={enviar} noValidate className="flex flex-col gap-u3">
            <div className="grid gap-u2 sm:grid-cols-2">
              <Campo
                etiqueta="CUIT"
                obligatorio
                inputMode="numeric"
                ayuda="Once dígitos, con o sin guiones."
                value={valores.cuit}
                onChange={(e) => cambiar("cuit", e.target.value)}
                onBlur={revisarCuit}
                error={errores.cuit}
              />
              <Campo etiqueta="Tipo" obligatorio>
                {(props) => (
                  <Selector
                    {...props}
                    opciones={TIPOS_ORGANIZACION}
                    value={valores.tipo}
                    onChange={(e) => cambiar("tipo", e.target.value)}
                  />
                )}
              </Campo>
            </div>

            {avisoCuit && (
              <p
                role="alert"
                className="rounded border border-alerta bg-alerta-suave px-3 py-2 text-[length:var(--texto-dato)] text-alerta"
              >
                {avisoCuit}
              </p>
            )}

            <div className="grid gap-u2 sm:grid-cols-2">
              <Campo
                etiqueta="Razón social"
                obligatorio
                ayuda="Como figura en el estatuto."
                value={valores.razonSocial}
                onChange={(e) => cambiar("razonSocial", e.target.value)}
                error={errores.razonSocial}
              />
              <Campo
                etiqueta="Nombre de fantasía"
                ayuda="Con el que se conoce al comercio."
                value={valores.nombreFantasia}
                onChange={(e) => cambiar("nombreFantasia", e.target.value)}
                error={errores.nombreFantasia}
              />
            </div>

            {/* --- Dueños --- */}
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-tinta">
                Dueños <span className="text-sello">*</span>
              </legend>

              {duenos.length === 0 ? (
                <p className="mb-u2 text-[length:var(--texto-dato)] text-apagado">
                  Toda organización necesita al menos un titular registrado.
                </p>
              ) : (
                <ul className="mb-u2 flex flex-col gap-u1">
                  {duenos.map((d) => (
                    <li
                      key={d.personaId}
                      className="flex items-center justify-between gap-u2 rounded border border-borde bg-papel px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {[d.nombre, d.apellido].filter(Boolean).join(" ")}
                        </span>
                        <span className="block text-sm text-apagado">
                          DNI <Identificador valor={d.dni} tipo="dni" />
                          {d.porcentajeTitularidad != null && ` · ${d.porcentajeTitularidad}%`}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variante="fantasma"
                        tamano="chico"
                        aria-label={`Quitar a ${d.nombre} ${d.apellido}`}
                        onClick={() =>
                          setDuenos((ds) => ds.filter((x) => x.personaId !== d.personaId))
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {errores.duenos && (
                <p role="alert" className="mb-u2 text-sm font-medium text-sello">
                  {errores.duenos}
                </p>
              )}

              <ElegirDueno
                yaElegidos={duenos.map((d) => d.personaId)}
                disponible={Math.max(0, 100 - totalAsignado)}
                alAgregar={(d) => setDuenos((ds) => [...ds, d])}
              />
            </fieldset>

            {errorGeneral && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
              >
                {errorGeneral.status === 409
                  ? "Ya existe una organización con ese CUIT."
                  : mensajeAmable(errorGeneral)}
              </p>
            )}

            <div className="flex gap-u2">
              <Button type="submit" disabled={enviando}>
                {enviando ? "Registrando…" : "Registrar organización"}
              </Button>
              <Button asChild variante="secundario">
                <Link to={volverA}>Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardCuerpo>
      </Card>
    </>
  );
}

function ElegirDueno({ yaElegidos, disponible, alAgregar }) {
  const [abierto, setAbierto] = useState(false);
  const [persona, setPersona] = useState(null);
  const [porcentaje, setPorcentaje] = useState("");
  const [error, setError] = useState(null);

  function confirmar(evento) {
    evento.preventDefault();
    const num = porcentaje === "" ? null : Number(porcentaje);
    if (num !== null && (Number.isNaN(num) || num <= 0 || num > disponible)) {
      setError(`Tiene que ser un número entre 0,01 y ${disponible}.`);
      return;
    }
    alAgregar({
      personaId: persona.id,
      nombre: persona.nombre,
      apellido: persona.apellido,
      dni: persona.dni,
      porcentajeTitularidad: num,
    });
    setAbierto(false);
    setPersona(null);
    setPorcentaje("");
  }

  return (
    <Dialogo
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setPersona(null);
          setPorcentaje("");
          setError(null);
        }
      }}
    >
      <DisparadorDialogo asChild>
        <Button type="button" variante="secundario" tamano="chico">
          <UserPlus aria-hidden="true" />
          Agregar dueño
        </Button>
      </DisparadorDialogo>

      <ContenidoDialogo
        className="max-w-lg"
        titulo="Agregar dueño"
        descripcion="Buscá a la persona por su DNI."
      >
        {!persona ? (
          <BuscadorDePersona
            etiqueta="DNI del dueño"
            alEncontrar={(p) => {
              if (yaElegidos.includes(p.id)) {
                // No hace falta molestar al backend para saber esto.
                setError("Esa persona ya está en la lista.");
                return;
              }
              setPersona(p);
              setError(null);
            }}
            autoFocus
          />
        ) : (
          <form onSubmit={confirmar} noValidate className="flex flex-col gap-u2">
            <p className="rounded border border-borde bg-papel px-3 py-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-apagado">
                Dueño
              </span>
              <span className="font-medium">
                {[persona.nombre, persona.apellido].filter(Boolean).join(" ")}
              </span>
            </p>

            <Campo
              etiqueta="Porcentaje de titularidad"
              type="number"
              step="0.01"
              min="0.01"
              max={disponible}
              ayuda={`Opcional. Queda ${disponible}% sin asignar.`}
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value);
                setError(null);
              }}
              error={error}
            />

            <div className="mt-u1 flex justify-end gap-u2">
              <CerrarDialogo asChild>
                <Button type="button" variante="secundario">
                  Cancelar
                </Button>
              </CerrarDialogo>
              <Button type="submit">Agregar</Button>
            </div>
          </form>
        )}

        {!persona && error && (
          <p role="alert" className="mt-u2 text-sm font-medium text-sello">
            {error}
          </p>
        )}
      </ContenidoDialogo>
    </Dialogo>
  );
}

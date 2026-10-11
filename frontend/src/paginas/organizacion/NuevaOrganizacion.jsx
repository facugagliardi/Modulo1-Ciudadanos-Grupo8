import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, ShieldCheck, Clock, UserPlus, Trash2 } from "lucide-react";
import { buscarPorCuit, crearOrganizacion } from "@/lib/api/endpoints/organizaciones";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { TIPOS_ORGANIZACION } from "@/lib/dominio/listasBlancas";
import { useSesion } from "@/lib/auth/SesionContext";
import { Encabezado } from "@/componentes/Encabezado";
import { BuscadorDeCiudadano, CiudadanoElegida } from "@/componentes/BuscadorDePersona";
import { Button } from "@/componentes/ui/button";
import { Campo, Selector } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { Dialogo, DisparadorDialogo, ContenidoDialogo } from "@/componentes/ui/dialog";

/**
 * Alta de organización.
 *
 * El creador autenticado queda registrado automáticamente como dueño.
 * También se pueden agregar otros dueños (copropietarios) y definir porcentajes de titularidad.
 * La organización queda en estado PENDIENTE hasta ser aprobada por un empleado administrativo.
 */
export function NuevaOrganizacion({ zona = "admin" }) {
  const navegar = useNavigate();
  const { id: miId } = useSesion();
  const volverA = zona === "admin" ? "/admin/organizaciones" : "/portal/organizaciones";

  const [valores, setValores] = useState({
    cuit: "",
    razonSocial: "",
    nombreFantasia: "",
    tipo: "SRL",
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [avisoCuit, setAvisoCuit] = useState(null);

  // Dueños y co-dueños
  const [porcentajeCreador, setPorcentajeCreador] = useState("100");
  const [otrosDuenos, setOtrosDuenos] = useState([]);
  const [sumandoOtro, setSumandoOtro] = useState(false);
  const [nuevoDueno, setNuevoDueno] = useState(null);
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState("");
  const [errorNuevoDueno, setErrorNuevoDueno] = useState(null);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

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

  function validar() {
    const e = {};
    const cuit = soloDigitos(valores.cuit);
    if (!cuit) e.cuit = "Ingresá el CUIT.";
    else if (cuit.length !== 11) e.cuit = "El CUIT tiene 11 dígitos.";
    if (!valores.razonSocial.trim()) e.razonSocial = "Ingresá la razón social.";

    const pc = Number(porcentajeCreador);
    if (isNaN(pc) || pc <= 0 || pc > 100) {
      e.porcentajeCreador = "El creador debe tener un porcentaje entre 0,01% y 100%.";
    }

    const sumaOtros = otrosDuenos.reduce((acc, d) => acc + Number(d.porcentajeTitularidad || 0), 0);
    const total = pc + sumaOtros;
    if (Math.abs(total - 100) > 0.01) {
      e.porcentajes = `La suma total de titularidades debe ser exactamente 100% (actualmente es ${Number(total.toFixed(2))}%).`;
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
      const payload = {
        ...valores,
        porcentajeCreador: Number(porcentajeCreador),
        otrosDuenos: otrosDuenos.map((d) => ({
          ciudadanoId: d.ciudadano.id,
          personaId: d.ciudadano.id,
          porcentajeTitularidad: Number(d.porcentajeTitularidad),
        })),
      };
      const creada = await crearOrganizacion(payload);
      navegar(`${volverA}/${creada.organizacionId}`, { replace: true });
    } catch (error) {
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  function agregarCopropietario() {
    setErrorNuevoDueno(null);
    const p = Number(nuevoPorcentaje);
    if (!p || isNaN(p) || p <= 0 || p >= 100) {
      setErrorNuevoDueno("Ingresá un porcentaje válido entre 0,01% y 99,99%.");
      return;
    }

    const sumaOtrosActual = otrosDuenos.reduce((acc, d) => acc + Number(d.porcentajeTitularidad || 0), 0);
    if (sumaOtrosActual + p >= 100) {
      setErrorNuevoDueno(`La suma de otros dueños (${sumaOtrosActual + p}%) debe ser menor al 100% para que el creador conserve titularidad.`);
      return;
    }

    const actualizados = [...otrosDuenos, { ciudadano: nuevoDueno, porcentajeTitularidad: nuevoPorcentaje }];
    setOtrosDuenos(actualizados);

    // Ajustar porcentaje del creador automáticamente
    const nuevoCreador = Math.max(0, 100 - (sumaOtrosActual + p));
    setPorcentajeCreador(String(Number(nuevoCreador.toFixed(2))));

    setSumandoOtro(false);
    setNuevoDueno(null);
    setNuevoPorcentaje("");
  }

  function quitarCopropietario(index) {
    const quitado = otrosDuenos[index];
    const actualizados = otrosDuenos.filter((_, i) => i !== index);
    setOtrosDuenos(actualizados);

    // Devolver el porcentaje al creador
    const pQuitado = Number(quitado.porcentajeTitularidad || 0);
    const actualCreador = Number(porcentajeCreador || 0);
    setPorcentajeCreador(String(Number(Math.min(100, actualCreador + pQuitado).toFixed(2))));
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
              <Selector
                etiqueta="Tipo de organización"
                obligatorio
                opciones={TIPOS_ORGANIZACION}
                value={valores.tipo}
                onChange={(e) => cambiar("tipo", e.target.value)}
              />
            </div>

            {avisoCuit && (
              <p role="status" className="text-sm font-medium text-aviso">
                {avisoCuit}
              </p>
            )}

            <div className="grid gap-u2 sm:grid-cols-2">
              <Campo
                etiqueta="Razón social"
                obligatorio
                ayuda="Como figura en el estatuto o contrato."
                value={valores.razonSocial}
                onChange={(e) => cambiar("razonSocial", e.target.value)}
                error={errores.razonSocial}
              />
              <Campo
                etiqueta="Nombre de fantasía"
                ayuda="Con el que se conoce al comercio o empresa."
                value={valores.nombreFantasia}
                onChange={(e) => cambiar("nombreFantasia", e.target.value)}
                error={errores.nombreFantasia}
              />
            </div>

            {/* --- Sección Dueños y Titularidad --- */}
            <div className="rounded border border-borde bg-papel p-4 flex flex-col gap-u2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-tinta">Dueños y titularidad</h2>
                  <p className="text-xs text-apagado">
                    Como creador de la empresa figurás como dueño inicial. Podés sumar otros dueños.
                  </p>
                </div>
                <Dialogo
                  open={sumandoOtro}
                  onOpenChange={(v) => {
                    setSumandoOtro(v);
                    if (!v) {
                      setNuevoDueno(null);
                      setNuevoPorcentaje("");
                      setErrorNuevoDueno(null);
                    }
                  }}
                >
                  <DisparadorDialogo asChild>
                    <Button
                      type="button"
                      variante="secundario"
                      tamano="chico"
                    >
                      <UserPlus className="size-4 mr-1.5" aria-hidden="true" />
                      Agregar otro dueño
                    </Button>
                  </DisparadorDialogo>

                  <ContenidoDialogo
                    className="max-w-lg"
                    titulo="Agregar copropietario"
                    descripcion="El vecino debe estar registrado en el municipio."
                  >
                    {!nuevoDueno ? (
                      <BuscadorDeCiudadano
                        etiqueta="DNI del nuevo dueño"
                        ayuda="Ingresá su DNI sin puntos."
                        alEncontrar={(c) => {
                          if (c.id === miId) {
                            setErrorNuevoDueno("Vos ya sos el creador de la empresa.");
                            return;
                          }
                          if (otrosDuenos.some((o) => o.ciudadano.id === c.id)) {
                            setErrorNuevoDueno("Este ciudadano ya está en la lista de dueños.");
                            return;
                          }
                          setNuevoDueno(c);
                          setErrorNuevoDueno(null);
                        }}
                      />
                    ) : (
                      <div className="flex flex-col gap-u2">
                        <CiudadanoElegida
                          ciudadano={nuevoDueno}
                          alCambiar={() => setNuevoDueno(null)}
                        />
                        <div className="flex items-end gap-u2">
                          <Campo
                            etiqueta="Porcentaje de titularidad (%)"
                            obligatorio
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="99.99"
                            value={nuevoPorcentaje}
                            onChange={(e) => {
                              setNuevoPorcentaje(e.target.value);
                              setErrorNuevoDueno(null);
                            }}
                          />
                          <Button type="button" onClick={agregarCopropietario}>
                            Confirmar dueño
                          </Button>
                        </div>
                      </div>
                    )}

                    {errorNuevoDueno && (
                      <p role="alert" className="text-xs text-sello font-medium mt-1">
                        {errorNuevoDueno}
                      </p>
                    )}
                  </ContenidoDialogo>
                </Dialogo>
              </div>

              {/* Dueño creador */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-borde bg-fondo p-3">
                <div className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-expediente">
                    Creador (Vos)
                  </span>
                  <span className="text-sm text-apagado">Dueño titular principal</span>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="porcentaje-creador" className="text-xs text-apagado">
                    Titularidad (%):
                  </label>
                  <input
                    id="porcentaje-creador"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    className="w-24 rounded border border-borde bg-papel px-2 py-1 text-sm text-right font-medium"
                    value={porcentajeCreador}
                    onChange={(e) => {
                      setPorcentajeCreador(e.target.value);
                      setErrores((prev) => ({ ...prev, porcentajeCreador: undefined, porcentajes: undefined }));
                    }}
                  />
                </div>
              </div>
              {errores.porcentajeCreador && (
                <p className="text-xs text-sello font-medium">{errores.porcentajeCreador}</p>
              )}

              {/* Lista de otros dueños */}
              {otrosDuenos.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {otrosDuenos.map((od, idx) => (
                    <div
                      key={od.ciudadano.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-borde bg-fondo p-3"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-sm">
                          {[od.ciudadano.nombre, od.ciudadano.apellido].filter(Boolean).join(" ")}
                        </span>
                        <span className="block text-xs text-apagado">
                          DNI {od.ciudadano.dni || od.ciudadano.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{od.porcentajeTitularidad}%</span>
                        <Button
                          type="button"
                          variante="fantasma"
                          tamano="chico"
                          onClick={() => quitarCopropietario(idx)}
                          aria-label={`Quitar a ${od.ciudadano.nombre}`}
                        >
                          <Trash2 className="size-4 text-sello" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}


              {errores.porcentajes && (
                <p role="alert" className="text-xs text-sello font-medium mt-1">
                  {errores.porcentajes}
                </p>
              )}
            </div>

            <div className="rounded border border-borde bg-papel p-3 text-sm text-apagado flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <Clock className="size-5 shrink-0 text-aviso" aria-hidden="true" />
                <span>
                  <strong>Aprobación requerida:</strong> La organización se creará en estado <em>PENDIENTE</em> y requerirá ser aprobada por el área administrativa antes de estar activa.
                </span>
              </div>
            </div>

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

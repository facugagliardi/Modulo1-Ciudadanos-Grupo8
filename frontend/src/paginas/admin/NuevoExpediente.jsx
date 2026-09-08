import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { crearExpediente } from "@/lib/api/endpoints/expedientes";
import { buscarPorDni } from "@/lib/api/endpoints/ciudadanos";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { Encabezado } from "@/componentes/Encabezado";
import { Button } from "@/componentes/ui/button";
import { Campo } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { ENTIDADES } from "@/lib/dominio/estados";

/**
 * Alta de expediente.
 *
 * El número lo genera el backend (`EXP-{año}-{6 dígitos}`) si no se manda uno,
 * y eso es lo que conviene: el módulo garantiza que sea único e irrepetible, y
 * escribirlo a mano sólo abre la puerta a colisiones.
 *
 * El titular se busca por DNI porque el alta necesita su `personaId` y la única
 * consulta disponible es por documento.
 */
export function NuevoExpediente() {
  const navegar = useNavigate();

  const [dni, setDni] = useState("");
  const [titular, setTitular] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [errorDni, setErrorDni] = useState(null);

  const [valores, setValores] = useState({ caratula: "", areaIniciadora: "" });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function buscar(evento) {
    evento.preventDefault();
    setErrorDni(null);
    setTitular(null);
    const limpio = soloDigitos(dni);
    if (limpio.length < 7 || limpio.length > 9) {
      setErrorDni("El DNI tiene entre 7 y 9 dígitos.");
      return;
    }
    setBuscando(true);
    try {
      const res = await buscarPorDni(limpio);
      if (!res?.existe) {
        setErrorDni("No hay ningún vecino con ese DNI. Tiene que registrarse antes.");
        return;
      }
      setTitular(res);
    } catch (e) {
      setErrorDni(mensajeAmable(e));
    } finally {
      setBuscando(false);
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);

    const e = {};
    if (!valores.caratula.trim()) e.caratula = "Escribí la carátula del expediente.";
    if (!valores.areaIniciadora.trim()) e.areaIniciadora = "Indicá el área que lo inicia.";
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      const creado = await crearExpediente({
        personaId: titular.id,
        caratula: valores.caratula.trim(),
        areaIniciadora: valores.areaIniciadora.trim(),
      });
      navegar(`/admin/expedientes/${creado.expedienteId}`, { replace: true });
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
        to="/admin/expedientes"
        className="mb-u2 inline-flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado hover:text-expediente"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a expedientes
      </Link>

      <Encabezado
        seccion="Gestión interna"
        titulo="Iniciar expediente"
        descripcion="Se abre en estado iniciado y con un número único que asigna el sistema."
      />

      <Card className="max-w-2xl">
        <CardCuerpo className="flex flex-col gap-u3">
          {/* Paso 1: el titular */}
          {!titular ? (
            <form onSubmit={buscar} noValidate className="flex flex-col gap-u2">
              <Campo
                etiqueta="DNI del titular"
                obligatorio
                inputMode="numeric"
                ayuda="El expediente se abre a nombre de una persona registrada."
                value={dni}
                onChange={(e) => {
                  setDni(e.target.value);
                  setErrorDni(null);
                }}
                error={errorDni}
              />
              <div>
                <Button type="submit" disabled={buscando}>
                  {buscando ? "Buscando…" : "Buscar titular"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-u2 rounded border border-borde bg-papel px-u3 py-u2">
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-apagado">
                    Titular
                  </span>
                  <span className="font-medium">
                    {[titular.nombre, titular.apellido].filter(Boolean).join(" ")}
                  </span>
                </span>
                <span className="flex items-center gap-u2">
                  <BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={titular.estado} />
                  <Button variante="fantasma" tamano="chico" onClick={() => setTitular(null)}>
                    Cambiar
                  </Button>
                </span>
              </div>

              {titular.estado === "FALLECIDO" && (
                <p
                  role="alert"
                  className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] text-sello"
                >
                  Esta persona figura como fallecida. Revisá que corresponda abrir un
                  expediente a su nombre.
                </p>
              )}

              {/* Paso 2: la carátula */}
              <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
                <Campo
                  etiqueta="Carátula"
                  obligatorio
                  ayuda="El asunto, como va a leerse en la tapa. Por ejemplo: “Habilitación comercial — kiosco de Av. Rivadavia 4520”."
                  value={valores.caratula}
                  onChange={(e) => {
                    setValores((v) => ({ ...v, caratula: e.target.value }));
                    setErrores((x) => ({ ...x, caratula: undefined }));
                  }}
                  error={errores.caratula}
                />

                <Campo
                  etiqueta="Área iniciadora"
                  obligatorio
                  ayuda="El área que abre el trámite. Por ejemplo: Mesa de entradas, Habilitaciones, Obras."
                  value={valores.areaIniciadora}
                  onChange={(e) => {
                    setValores((v) => ({ ...v, areaIniciadora: e.target.value }));
                    setErrores((x) => ({ ...x, areaIniciadora: undefined }));
                  }}
                  error={errores.areaIniciadora}
                />

                <p className="text-sm text-apagado">
                  El número lo genera el sistema al crearlo.
                </p>

                {errorGeneral && (
                  <p
                    role="alert"
                    className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
                  >
                    {mensajeAmable(errorGeneral)}
                  </p>
                )}

                <div className="mt-u1 flex gap-u2">
                  <Button type="submit" disabled={enviando}>
                    {enviando ? "Creando…" : "Iniciar expediente"}
                  </Button>
                  <Button asChild variante="secundario">
                    <Link to="/admin/expedientes">Cancelar</Link>
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardCuerpo>
      </Card>
    </>
  );
}

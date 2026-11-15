import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { verificarDni } from "@/lib/api/endpoints/auth";
import { mensajeAmable } from "@/lib/api/cliente";
import { comprimirImagen, unirFrenteYDorso } from "@/lib/dominio/imagen";
import { Button } from "@/componentes/ui/button";

/**
 * Paso de registro para nacionalidad argentina: el usuario saca una foto del
 * frente y otra del dorso, se unen en una sola imagen (frente arriba, dorso
 * abajo) y el backend la lee con Groq y compara contra lo que tipeó. La
 * cuenta se crea recién cuando todo coincide (eso lo hace `onConfirmar`).
 */
export function VerificacionDni({ valores, onCorregir, onConfirmar, creando, errorCreacion }) {
  const [fotos, setFotos] = useState({ frente: null, dorso: null });
  const [errorFoto, setErrorFoto] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [errorVerificacion, setErrorVerificacion] = useState(null);

  async function elegirFoto(cual, archivo) {
    setErrorFoto(null);
    setResultado(null);
    setErrorVerificacion(null);
    if (!archivo) return;
    try {
      const comprimida = await comprimirImagen(archivo);
      setFotos((f) => ({ ...f, [cual]: comprimida }));
    } catch (error) {
      setErrorFoto(error.message);
    }
  }

  async function verificar() {
    setErrorVerificacion(null);
    if (!fotos.frente || !fotos.dorso) {
      setErrorFoto("Subí la foto del frente y la del dorso.");
      return;
    }
    setVerificando(true);
    try {
      const imagen = await unirFrenteYDorso(fotos.frente, fotos.dorso);
      setResultado(await verificarDni({ ...valores, imagen }));
    } catch (error) {
      setErrorVerificacion(mensajeAmable(error));
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="flex flex-col gap-u3 rounded border border-borde bg-papel p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-expediente-suave p-2 text-expediente">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Verificá tu DNI</h1>
          <p className="text-sm text-apagado">
            Subí una foto del frente y otra del dorso. Las comparamos con los datos que cargaste
            antes de crear la cuenta.
          </p>
        </div>
      </div>

      <div className="grid gap-u2 sm:grid-cols-2">
        <SelectorDeFoto id="dni-frente" etiqueta="Frente" foto={fotos.frente} onElegir={(a) => elegirFoto("frente", a)} />
        <SelectorDeFoto id="dni-dorso" etiqueta="Dorso" foto={fotos.dorso} onElegir={(a) => elegirFoto("dorso", a)} />
      </div>

      <p className="text-xs text-apagado">
        Con buena luz, sin flash ni reflejos, y con el DNI entero en la foto.
      </p>

      {errorFoto && <Alerta>{errorFoto}</Alerta>}
      {errorVerificacion && <Alerta>{errorVerificacion}</Alerta>}

      {resultado && <ResultadoVerificacion resultado={resultado} />}
      {errorCreacion && <Alerta>{errorCreacion}</Alerta>}

      {resultado?.coincide ? (
        <Button type="button" onClick={() => onConfirmar(fotos)} disabled={creando} className="w-full">
          {creando ? "Creando la cuenta…" : "Crear mi cuenta"}
        </Button>
      ) : (
        <div className="flex flex-col gap-u1 sm:flex-row">
          <Button type="button" variante="secundario" onClick={onCorregir} disabled={verificando} className="sm:flex-1">
            Corregir mis datos
          </Button>
          <Button type="button" onClick={verificar} disabled={verificando} className="sm:flex-1">
            {verificando ? "Leyendo tu DNI…" : resultado ? "Verificar de nuevo" : "Verificar DNI"}
          </Button>
        </div>
      )}
    </div>
  );
}

function SelectorDeFoto({ id, etiqueta, foto, onElegir }) {
  const [vista, setVista] = useState(null);

  useEffect(() => {
    if (!foto || typeof URL.createObjectURL !== "function") return undefined;
    const url = URL.createObjectURL(foto);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  return (
    <label
      htmlFor={id}
      className="flex aspect-[1.6] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded border-2 border-dashed border-borde bg-superficie text-center hover:border-expediente"
    >
      {foto && vista ? (
        <img src={vista} alt={`${etiqueta} del DNI`} className="size-full object-cover" />
      ) : (
        <>
          <Camera className="size-7 text-apagado" aria-hidden="true" />
          <span className="text-sm font-medium text-expediente">{etiqueta} del DNI</span>
          {foto && <span className="text-xs text-apagado">{foto.name}</span>}
        </>
      )}
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Foto del ${etiqueta.toLowerCase()} del DNI`}
        className="sr-only"
        onChange={(e) => onElegir(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function ResultadoVerificacion({ resultado }) {
  const { coincide, campos = [], problemas = [] } = resultado;
  return (
    <div className="flex flex-col gap-u2" aria-live="polite">
      {coincide ? (
        <p className="flex items-center gap-2 rounded border border-vigente bg-vigente-suave px-3 py-2 text-sm font-medium text-vigente">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Tus datos coinciden con el DNI.
        </p>
      ) : (
        <Alerta>
          Los datos no coinciden con el DNI. Revisá lo marcado abajo: corregí tus datos o probá con otras fotos.
          {problemas.length > 0 && (
            <ul className="mt-1 list-disc pl-5 font-normal">
              {problemas.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </Alerta>
      )}

      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-apagado">
          <tr>
            <th className="py-1 pr-2 font-semibold">Dato</th>
            <th className="py-1 pr-2 font-semibold">Ingresaste</th>
            <th className="py-1 pr-2 font-semibold">Dice el DNI</th>
            <th className="py-1"><span className="sr-only">Resultado</span></th>
          </tr>
        </thead>
        <tbody>
          {campos.map((c) => (
            <tr key={c.campo} className="border-t border-borde align-top">
              <td className="py-1.5 pr-2 font-medium">{c.etiqueta}</td>
              <td className="py-1.5 pr-2">{c.ingresado || "—"}</td>
              <td className="py-1.5 pr-2">
                {c.leido || "—"}
                {c.detalle && <span className="block text-xs text-apagado">{c.detalle}</span>}
              </td>
              <td className="py-1.5">
                {c.coincide ? (
                  <CheckCircle2 className="size-4 text-vigente" aria-label="Coincide" />
                ) : (
                  <XCircle className="size-4 text-sello" aria-label="No coincide" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Alerta({ children }) {
  return (
    <div role="alert" className="rounded border border-sello bg-sello-suave px-3 py-2 text-sm font-medium text-sello">
      {children}
    </div>
  );
}

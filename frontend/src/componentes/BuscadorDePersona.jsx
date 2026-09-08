import { useState } from "react";
import { buscarPorDni } from "@/lib/api/endpoints/ciudadanos";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { BadgeEstado } from "./BadgeEstado";
import { Button } from "./ui/button";
import { Campo } from "./ui/campo";

/**
 * Buscar a una persona por su DNI.
 *
 * Aparece cada vez que hay que referirse a alguien: vincular un familiar, abrir
 * un expediente a su nombre, pedirle documentación, sumarlo como dueño de una
 * organización. En todos esos casos el backend necesita el `personaId` y la
 * única consulta disponible es por documento.
 *
 * `GET /ciudadanos/dni/{dni}` nunca devuelve 404: responde `{existe:false}`.
 */
export function BuscadorDePersona({
  etiqueta = "DNI de la persona",
  ayuda = "Tiene que estar registrada en el municipio.",
  alEncontrar,
  excluirId,
  textoExcluido = "Esa persona ya está.",
  autoFocus,
}) {
  const [dni, setDni] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);

  async function buscar(evento) {
    evento.preventDefault();
    setError(null);
    const limpio = soloDigitos(dni);
    if (limpio.length < 7 || limpio.length > 9) {
      setError("El DNI tiene entre 7 y 9 dígitos.");
      return;
    }
    setBuscando(true);
    try {
      const res = await buscarPorDni(limpio);
      if (!res?.existe) {
        setError("No encontramos a nadie con ese DNI. Tiene que registrarse primero.");
        return;
      }
      if (excluirId && res.id === excluirId) {
        setError(textoExcluido);
        return;
      }
      alEncontrar(res);
    } catch (e) {
      setError(mensajeAmable(e));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <form onSubmit={buscar} noValidate className="flex flex-col gap-u2">
      <Campo
        etiqueta={etiqueta}
        obligatorio
        inputMode="numeric"
        autoFocus={autoFocus}
        ayuda={ayuda}
        value={dni}
        onChange={(e) => {
          setDni(e.target.value);
          setError(null);
        }}
        error={error}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </Button>
      </div>
    </form>
  );
}

/** La persona ya encontrada, con la opción de cambiarla. */
export function PersonaElegida({ persona, alCambiar, etiqueta = "Persona" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-u2 rounded border border-borde bg-papel px-3 py-2">
      <span>
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-apagado">
          {etiqueta}
        </span>
        <span className="font-medium">
          {[persona.nombre, persona.apellido].filter(Boolean).join(" ") || `Persona #${persona.id}`}
        </span>
      </span>
      <span className="flex items-center gap-u2">
        {persona.estado && (
          <BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={persona.estado} />
        )}
        {alCambiar && (
          <Button type="button" variante="fantasma" tamano="chico" onClick={alCambiar}>
            Cambiar
          </Button>
        )}
      </span>
    </div>
  );
}

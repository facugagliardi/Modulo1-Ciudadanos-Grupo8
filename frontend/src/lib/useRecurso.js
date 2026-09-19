import { useCallback, useEffect, useState } from "react";

/**
 * Carga datos y expone los tres estados que toda pantalla necesita distinguir:
 * cargando, error y vacío. El enunciado pide "estados de carga" explícitamente,
 * y tenerlos en un solo lugar evita que cada pantalla los invente distinto.
 *
 * Cancela el pedido anterior si `cargar` cambia antes de que responda, así una
 * búsqueda rápida no pinta el resultado viejo encima del nuevo.
 *
 * IMPORTANTE: `cargar` tiene que venir envuelto en `useCallback` con sus
 * propias dependencias. El hook se apoya en la identidad de esa función para
 * decidir cuándo recargar; una función inline nueva en cada render dispararía
 * un pedido infinito.
 *
 *   const persona = useRecurso(useCallback((s) => obtenerCiudadano(id, s), [id]));
 *
 * (Antes este hook aceptaba un array `deps` y volvía a memoizar `cargar` con
 * él. Cuando el llamador ya usaba useCallback —siempre— eso congelaba la
 * primera versión de la función y el recurso nunca se recargaba al cambiar sus
 * dependencias. Por eso ahora la única fuente de verdad es `cargar`.)
 *
 * @param cargar  (senal) => Promise<datos>, memoizado por el llamador
 */
export function useRecurso(cargar) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    let vigente = true;

    setCargando(true);
    setError(null);

    cargar(control.signal)
      .then((res) => {
        if (vigente) setDatos(res);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        if (vigente) setError(e);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
      control.abort();
    };
  }, [cargar, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { datos, error, cargando, recargar, setDatos };
}

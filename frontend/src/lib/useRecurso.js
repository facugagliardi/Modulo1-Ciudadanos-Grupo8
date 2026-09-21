import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carga datos y expone los tres estados que toda pantalla necesita distinguir:
 * cargando, error y vacío. El enunciado pide "estados de carga" explícitamente,
 * y tenerlos en un solo lugar evita que cada pantalla los invente distinto.
 *
 * Cancela el pedido anterior si `cargar` cambia antes de que responda, así una
 * búsqueda rápida no pinta el resultado viejo encima del nuevo.
 *
 * Distingue dos cosas que no son lo mismo:
 *   - `cargando`: no hay nada válido que mostrar todavía. Va la pantalla de
 *     carga.
 *   - `recargando`: hay un pedido en vuelo, pero lo que se ve sigue siendo
 *     válido. La pantalla NO se desmonta; a lo sumo se marca como ocupada.
 *
 * La diferencia importa: una acción que recarga la lista (marcar un domicilio
 * como principal, agregar un dueño) no debería hacer desaparecer y reaparecer
 * lo que la persona está mirando.
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
  const [recargando, setRecargando] = useState(true);
  const [version, setVersion] = useState(0);

  // De que consulta vinieron los datos que hay en pantalla. Sirve para
  // distinguir "estoy repitiendo la misma consulta" de "cambie de consulta":
  // en el segundo caso lo que se muestra ya no corresponde a lo que se pidio y
  // hay que volver a la pantalla de carga.
  const consultaDeLosDatos = useRef(null);

  useEffect(() => {
    const control = new AbortController();
    let vigente = true;

    setRecargando(true);
    setError(null);

    cargar(control.signal)
      .then((res) => {
        if (!vigente) return;
        consultaDeLosDatos.current = cargar;
        setDatos(res);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        if (vigente) setError(e);
      })
      .finally(() => {
        if (vigente) setRecargando(false);
      });

    return () => {
      vigente = false;
      control.abort();
    };
  }, [cargar, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const datosEnPantallaSirven = datos !== null && consultaDeLosDatos.current === cargar;

  return {
    datos,
    error,
    // Solo la PRIMERA carga, o una consulta distinta a la que dio los datos que
    // se ven. Al repetir la misma consulta —marcar un domicilio como principal
    // y recargar la lista— `cargando` queda en false y la lista no se
    // desmonta.
    //
    // Antes era true en toda recarga, y como el componente <Cargando /> mide
    // unos 112px y se monta ARRIBA de la lista, cada accion empujaba todo hacia
    // abajo y lo devolvia al instante. Se veia como un parpadeo. Es el mismo
    // problema que en las tablas ya resolvian las FilasFantasma.
    cargando: recargando && !datosEnPantallaSirven,
    // Hay un pedido en vuelo, haya o no datos en pantalla. Para marcar como
    // ocupado sin sacar nada de su lugar.
    recargando,
    recargar,
    setDatos,
  };
}

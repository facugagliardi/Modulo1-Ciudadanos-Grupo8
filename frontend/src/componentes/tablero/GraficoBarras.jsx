import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { EstadoVacio } from "@/componentes/Estados";

/**
 * Barras horizontales. Es el único gráfico del sistema, a propósito.
 *
 * DECISIONES QUE NO SON DE GUSTO:
 *
 * - **Todas las barras llevan la misma tinta.** Colorear cada barra distinto
 *   según su valor gastaría el canal del color en repetir lo que el largo ya
 *   dice. La identidad la lleva la etiqueta de la izquierda — que para los
 *   estados es el mismo badge que usa el resto de la aplicación, con su color y
 *   su candado.
 * - **El valor va en la punta**, no flotando en un tooltip: un dato que sólo se
 *   puede leer pasando el mouse no existe para quien usa teclado.
 * - **Toda barra tiene su tabla gemela.** El botón "Ver tabla" cambia a un
 *   `<table>` de verdad con el recuento y el porcentaje.
 * - Punta redondeada y base recta: la barra crece desde una línea, y se nota.
 */
export function GraficoBarras({ titulo, descripcion, datos, unidad = "", vacio }) {
  const [comoTabla, setComoTabla] = useState(false);
  const idTitulo = useId();

  const total = datos.reduce((t, d) => t + d.valor, 0);
  const maximo = Math.max(1, ...datos.map((d) => d.valor));
  const porcentaje = (v) => (total === 0 ? 0 : Math.round((v / total) * 100));

  return (
    <section aria-labelledby={idTitulo} className="rounded border border-borde bg-superficie">
      <header className="flex flex-wrap items-start justify-between gap-u2 border-b border-borde px-u3 py-u2">
        <div>
          <h3 id={idTitulo} className="text-base font-semibold text-tinta">
            {titulo}
          </h3>
          {descripcion && <p className="text-sm text-apagado">{descripcion}</p>}
        </div>
        {datos.length > 0 && (
          <button
            type="button"
            onClick={() => setComoTabla((v) => !v)}
            className="rounded text-sm font-medium text-expediente hover:underline"
          >
            {comoTabla ? "Ver gráfico" : "Ver tabla"}
          </button>
        )}
      </header>

      <div className="px-u3 py-u3">
        {datos.length === 0 ? (
          <EstadoVacio titulo={vacio ?? "Todavía no hay datos"} />
        ) : comoTabla ? (
          <table className="w-full text-[length:var(--texto-dato)]">
            <thead>
              <tr className="border-b border-borde text-left">
                <th scope="col" className="py-1 text-xs font-semibold uppercase tracking-wide text-apagado">
                  {unidad || "Categoría"}
                </th>
                <th scope="col" className="py-1 text-right text-xs font-semibold uppercase tracking-wide text-apagado">
                  Cantidad
                </th>
                <th scope="col" className="py-1 text-right text-xs font-semibold uppercase tracking-wide text-apagado">
                  Porcentaje
                </th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.clave} className="border-b border-borde last:border-0">
                  <th scope="row" className="py-1.5 font-normal text-tinta">
                    {d.etiquetaTexto ?? d.clave}
                  </th>
                  <td className="py-1.5 text-right tabular">{d.valor}</td>
                  <td className="py-1.5 text-right tabular text-apagado">{porcentaje(d.valor)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="flex flex-col gap-u2">
            {datos.map((d) => (
              <li key={d.clave} className="grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-u2">
                <span className="min-w-0 truncate text-[length:var(--texto-dato)]">
                  {d.etiqueta ?? d.clave}
                </span>
                <span className="flex items-center gap-2">
                  {/* La barra: base recta a la izquierda, punta redondeada a la
                      derecha. Nunca más de 20px de alto — el aire de la fila es
                      parte del diseño. */}
                  <span
                    className="h-5 rounded-r bg-expediente"
                    style={{ width: `${Math.max(2, (d.valor / maximo) * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="shrink-0 tabular text-[length:var(--texto-dato)] font-medium">
                    {d.valor}
                  </span>
                  <span className="shrink-0 tabular text-sm text-apagado">
                    {porcentaje(d.valor)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Un número que reclama una acción.
 *
 * El color va por severidad, no por decoración, y **siempre** con su icono y su
 * texto: nadie debería tener que distinguir un tono para saber que algo está
 * vencido. El valor usa cifras proporcionales, no tabulares — a este tamaño las
 * tabulares se ven sueltas.
 */
export function Indicador({ etiqueta, valor, detalle, severidad = "neutra", icono: Icono, accion }) {
  const tonos = {
    neutra: "text-tinta",
    buena: "text-vigente",
    atencion: "text-alerta",
    grave: "text-sello",
  };
  const bordes = {
    neutra: "border-borde",
    buena: "border-borde",
    atencion: "border-alerta",
    grave: "border-sello",
  };

  return (
    <div className={cn("rounded border bg-superficie px-u3 py-u3", bordes[severidad])}>
      <p className="flex items-center gap-1.5 text-[length:var(--texto-dato)] text-apagado">
        {Icono && <Icono className={cn("size-4 shrink-0", tonos[severidad])} aria-hidden="true" />}
        {etiqueta}
      </p>
      <p className={cn("mt-1 text-3xl font-semibold leading-none", tonos[severidad])}>{valor}</p>
      {detalle && <p className="mt-1.5 text-sm text-apagado">{detalle}</p>}
      {accion && <div className="mt-u2">{accion}</div>}
    </div>
  );
}

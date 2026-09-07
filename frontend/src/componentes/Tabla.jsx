import { useDeferredValue, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { comparar, normalizar } from "@/lib/texto";
import { Cargando, ErrorEnPantalla, EstadoVacio, FilasFantasma, SinResultados } from "./Estados";
import { Selector } from "./ui/campo";

/**
 * La tabla de todo el sistema.
 *
 * Existe por una razón concreta: el backend devuelve los listados COMPLETOS,
 * sin filtros ni paginación (`GET /ciudadanos` trae el padrón entero). Filtrar,
 * ordenar y paginar es responsabilidad del front — y es, además, lo que el
 * enunciado pide explícitamente. Con una sola implementación queda resuelto
 * para el padrón, las organizaciones, los expedientes, los documentos y las
 * solicitudes.
 *
 * Accesibilidad: tabla real con `th scope`, encabezados ordenables que son
 * botones de verdad y `aria-sort` para que un lector de pantalla anuncie el
 * orden. Si se pasa `enlaceFila`, la primera celda se vuelve un enlace real,
 * así la fila se puede alcanzar con el teclado y no solo con el mouse.
 */

const POR_PAGINA = [25, 50, 100];

export function Tabla({
  columnas,
  filas,
  claveFila,
  cargando = false,
  error = null,
  alReintentar,
  buscarEn = [],
  etiquetaBusqueda = "Buscar",
  filtros = [],
  enlaceFila,
  vacio,
  resumen,
  filasPorPaginaInicial = 25,
  className,
}) {
  const idBusqueda = useId();
  const [termino, setTermino] = useState("");
  const [valoresFiltro, setValoresFiltro] = useState({});
  const [orden, setOrden] = useState(null); // { clave, direccion }
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(filasPorPaginaInicial);

  // Mantiene la escritura fluida aunque el padrón tenga miles de filas.
  const terminoDiferido = useDeferredValue(termino);

  const filtradas = useMemo(() => {
    let res = filas ?? [];

    for (const f of filtros) {
      const valor = valoresFiltro[f.clave];
      if (valor) res = res.filter((fila) => String(fila[f.clave] ?? "") === valor);
    }

    const q = normalizar(terminoDiferido);
    if (q && buscarEn.length) {
      res = res.filter((fila) =>
        buscarEn.some((campo) => normalizar(fila[campo]).includes(q)),
      );
    }

    if (orden) {
      const col = columnas.find((c) => c.clave === orden.clave);
      const valorDe = col?.valorOrden ?? ((fila) => fila[orden.clave]);
      res = [...res].sort((a, b) => {
        const r = comparar(valorDe(a), valorDe(b));
        return orden.direccion === "asc" ? r : -r;
      });
    }
    return res;
  }, [filas, filtros, valoresFiltro, terminoDiferido, buscarEn, orden, columnas]);

  const total = filtradas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const desde = (paginaSegura - 1) * porPagina;
  const visibles = filtradas.slice(desde, desde + porPagina);

  const hayBusqueda = Boolean(termino) || Object.values(valoresFiltro).some(Boolean);

  function alternarOrden(clave) {
    setPagina(1);
    setOrden((actual) => {
      if (actual?.clave !== clave) return { clave, direccion: "asc" };
      if (actual.direccion === "asc") return { clave, direccion: "desc" };
      return null; // tercer clic: vuelve al orden original
    });
  }

  function limpiar() {
    setTermino("");
    setValoresFiltro({});
    setPagina(1);
  }

  return (
    <div className={cn("flex flex-col gap-u2", className)}>
      {/* --- Controles ------------------------------------------------- */}
      {(buscarEn.length > 0 || filtros.length > 0) && (
        <div className="flex flex-wrap items-end gap-u2">
          {buscarEn.length > 0 && (
            <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
              <label htmlFor={idBusqueda} className="text-sm font-medium text-tinta">
                {etiquetaBusqueda}
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-apagado"
                  aria-hidden="true"
                />
                <input
                  id={idBusqueda}
                  type="search"
                  value={termino}
                  onChange={(e) => {
                    setTermino(e.target.value);
                    setPagina(1);
                  }}
                  className="h-control w-full rounded border border-borde-fuerte bg-superficie pl-9 pr-3 text-[length:var(--texto-dato)] placeholder:text-apagado"
                  placeholder="Escribí para filtrar…"
                />
              </div>
            </div>
          )}

          {filtros.map((f) => (
            <div key={f.clave} className="flex w-48 flex-col gap-1.5">
              <label
                htmlFor={`filtro-${f.clave}`}
                className="text-sm font-medium text-tinta"
              >
                {f.etiqueta}
              </label>
              <Selector
                id={`filtro-${f.clave}`}
                placeholder={f.placeholder ?? "Todos"}
                opciones={f.opciones}
                value={valoresFiltro[f.clave] ?? ""}
                onChange={(e) => {
                  setValoresFiltro((v) => ({ ...v, [f.clave]: e.target.value }));
                  setPagina(1);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* --- Recuento -------------------------------------------------- */}
      {!cargando && !error && (
        <p className="text-sm text-apagado" role="status">
          {total === 0
            ? "Sin resultados"
            : `${total.toLocaleString("es-AR")} ${total === 1 ? "resultado" : "resultados"}`}
          {hayBusqueda && filas?.length ? ` de ${filas.length.toLocaleString("es-AR")}` : ""}
          {resumen ? ` · ${resumen}` : ""}
        </p>
      )}

      {/* --- Tabla ----------------------------------------------------- */}
      <div className="overflow-x-auto rounded border border-borde bg-superficie">
        <table className="w-full border-collapse text-[length:var(--texto-dato)]">
          <thead>
            <tr className="border-b border-borde-fuerte bg-papel text-left">
              {columnas.map((c) => {
                const activo = orden?.clave === c.clave;
                return (
                  <th
                    key={c.clave}
                    scope="col"
                    className={cn(
                      "px-u3 py-u2 text-xs font-semibold uppercase tracking-wide text-apagado",
                      c.alineacion === "derecha" && "text-right",
                      c.ancho,
                    )}
                    aria-sort={
                      activo ? (orden.direccion === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    {c.ordenable === false ? (
                      c.titulo
                    ) : (
                      <button
                        type="button"
                        onClick={() => alternarOrden(c.clave)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded hover:text-tinta",
                          activo && "text-tinta",
                        )}
                      >
                        {c.titulo}
                        {activo ? (
                          orden.direccion === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {activo
                            ? `, ordenado ${orden.direccion === "asc" ? "ascendente" : "descendente"}`
                            : ", ordenar"}
                        </span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {cargando && <FilasFantasma columnas={columnas.length} />}

            {!cargando &&
              visibles.map((fila) => {
                const clave = claveFila(fila);
                const href = enlaceFila?.(fila);
                return (
                  <tr
                    key={clave}
                    className={cn(
                      "border-b border-borde last:border-0",
                      href && "hover:bg-expediente-suave/60",
                    )}
                  >
                    {columnas.map((c, i) => (
                      <td
                        key={c.clave}
                        className={cn(
                          "h-fila px-u3 align-middle",
                          c.alineacion === "derecha" && "text-right",
                        )}
                      >
                        {i === 0 && href ? (
                          <Link
                            to={href}
                            className="font-medium text-expediente hover:underline"
                          >
                            {c.render ? c.render(fila) : fila[c.clave]}
                          </Link>
                        ) : c.render ? (
                          c.render(fila)
                        ) : (
                          (fila[c.clave] ?? <span className="text-apagado">—</span>)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>

        {!cargando && error && (
          <ErrorEnPantalla error={error} alReintentar={alReintentar} />
        )}
        {!cargando && !error && total === 0 && hayBusqueda && (
          <SinResultados termino={termino} alLimpiar={limpiar} />
        )}
        {!cargando && !error && total === 0 && !hayBusqueda && (
          <EstadoVacio
            titulo={vacio?.titulo ?? "Todavía no hay nada acá"}
            descripcion={vacio?.descripcion}
            accion={vacio?.accion}
          />
        )}
      </div>

      {/* --- Paginación ------------------------------------------------ */}
      {!cargando && !error && total > 0 && (
        <nav
          className="flex flex-wrap items-center justify-between gap-u2 text-sm"
          aria-label="Paginación"
        >
          <p className="text-apagado">
            Mostrando {desde + 1}–{Math.min(desde + porPagina, total)} de {total}
          </p>

          <div className="flex items-center gap-u2">
            <label className="flex items-center gap-2 text-apagado">
              Por página
              <Selector
                className="h-8 w-20"
                opciones={POR_PAGINA.map((n) => ({ valor: String(n), etiqueta: String(n) }))}
                value={String(porPagina)}
                onChange={(e) => {
                  setPorPagina(Number(e.target.value));
                  setPagina(1);
                }}
              />
            </label>

            <div className="flex items-center gap-1">
              <BotonPagina
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaSegura === 1}
              >
                Anterior
              </BotonPagina>
              <span className="px-2 text-apagado">
                {paginaSegura} de {totalPaginas}
              </span>
              <BotonPagina
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura === totalPaginas}
              >
                Siguiente
              </BotonPagina>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}

function BotonPagina({ className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "h-8 rounded border border-borde-fuerte bg-superficie px-3 font-medium text-tinta",
        "hover:bg-papel disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Cargando };

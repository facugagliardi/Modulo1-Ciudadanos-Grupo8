import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FileText, FolderOpen, LayoutDashboard, LogOut, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSesion } from "@/lib/auth/SesionContext";
import { etiquetaRol, PERMISOS } from "@/lib/auth/permisos";
import { salir } from "@/lib/api/endpoints/auth";
import { useEmpujon } from "@/lib/movimiento/useEmpujon";
import { Button } from "@/componentes/ui/button";
import { BotonDelMenu, MenuMovil, useMenuMovil } from "@/componentes/MenuMovil";
import { Marca } from "./Marca";
import { htmlDelFantasma } from "./fantasmasAdmin";

/**
 * Backoffice municipal. Densidad compacta: quien trabaja acá pasa ocho horas
 * frente a esta pantalla, y cada fila que entra de más es una menos que hay
 * que ir a buscar desplazándose.
 *
 * El menú se arma con los permisos del rol, así que un AUDITOR simplemente no
 * ve las secciones donde no puede hacer nada.
 *
 * Cambiar de sección empuja la pantalla para arriba o para abajo, según dónde
 * quede la nueva en el menú —es una columna—, como en la app de ZetaAccounting.
 * Ver `useEmpujon.js`.
 *
 * Debajo de `md` no hay barra lateral: va el menú del teléfono (`MenuMovil`),
 * con el rol, el legajo y salir en su pie.
 */

const SECCIONES = [
  { a: "/admin", icono: LayoutDashboard, texto: "Tablero", exacto: true },
  { a: "/admin/padron", icono: Users, texto: "Padrón", permiso: PERMISOS.LISTAR_PADRON },
  {
    a: "/admin/organizaciones",
    icono: FolderOpen,
    texto: "Organizaciones",
  },
  {
    a: "/admin/documentacion",
    icono: FileText,
    texto: "Documentación",
    permiso: PERMISOS.LEER_TERCEROS,
  },
  {
    a: "/admin/expedientes",
    icono: Search,
    texto: "Expedientes",
    permiso: PERMISOS.LEER_TERCEROS,
  },
];

export function LayoutAdmin() {
  const { rol, id, tienePermiso } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const menu = useMenuMovil();

  const visibles = SECCIONES.filter((s) => !s.permiso || tienePermiso(s.permiso));
  const { alClickear, conEntrada } = useEmpujon({
    secciones: visibles,
    eje: "y",
    fantasma: htmlDelFantasma,
    densidad: "densidad-compacta",
  });

  async function cerrar() {
    await salir();
    navegar("/ingresar", { replace: true });
  }

  return (
    <div className="densidad-compacta min-h-screen bg-papel" onClickCapture={alClickear}>
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>

      <header data-cabecera="" className="sticky top-0 z-30 border-b border-borde bg-superficie">
        <div className="flex h-14 items-center gap-u3 px-u3">
          <Marca />

          <span className="ml-2 hidden rounded bg-expediente-suave px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-expediente sm:inline">
            Gestión interna
          </span>

          <div className="ml-auto hidden items-center gap-u2 md:flex">
            <span className="text-right text-xs leading-tight">
              <span className="block font-medium text-tinta">{etiquetaRol(rol)}</span>
              <span className="identificador block text-apagado">Legajo {id}</span>
            </span>
            <Button variante="secundario" tamano="chico" onClick={cerrar}>
              <LogOut aria-hidden="true" />
              Salir
            </Button>
          </div>

          <BotonDelMenu menu={menu} className="ml-auto md:hidden" />
        </div>
      </header>

      <div className="flex">
        {/* Barra lateral */}
        <nav
          data-lateral=""
          aria-label="Secciones"
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-borde bg-superficie p-u2 md:block"
        >
          <ul className="flex flex-col gap-0.5">
            {visibles.map(({ a, icono: Icono, texto, exacto }) => (
              <li key={a}>
                <NavLink
                  to={a}
                  end={exacto}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded px-2.5 py-2 text-[length:var(--texto-dato)] transition-colors duration-150",
                      isActive
                        ? "bg-expediente-suave font-semibold text-expediente"
                        : "text-tinta hover:bg-papel",
                    )
                  }
                >
                  <Icono className="size-4 shrink-0" aria-hidden="true" />
                  {texto}
                </NavLink>
              </li>
            ))}
          </ul>

          {rol === "AUDITOR" && (
            <p className="mt-u3 rounded border border-borde bg-papel p-2.5 text-xs leading-relaxed text-apagado">
              Tu rol es de consulta: podés ver todo el sistema, pero no modificar
              información.
            </p>
          )}
        </nav>

        {/* Afuera de la cabecera: abierto, se va con la foto vieja en el empujón. */}
        <MenuMovil
          menu={menu}
          className="md:hidden"
          grupos={[{ titulo: "Gestión interna", items: visibles }]}
          pie={
            <>
              <p className="text-sm leading-tight">
                <span className="block font-medium text-tinta">{etiquetaRol(rol)}</span>
                <span className="identificador block text-apagado">Legajo {id}</span>
              </p>
              {rol === "AUDITOR" && (
                <p className="text-sm leading-relaxed text-apagado">
                  Tu rol es de consulta: podés ver todo el sistema, pero no modificar
                  información.
                </p>
              )}
              <Button
                variante="secundario"
                className="justify-self-start"
                onClick={() => {
                  menu.cerrarYa();
                  cerrar();
                }}
              >
                <LogOut aria-hidden="true" />
                Salir
              </Button>
            </>
          }
        />

        {/* La key hace que la entrada corra una vez por pantalla, no en cada
            render. Sin ella la animación no se vuelve a disparar al navegar. La
            pantalla que llega empujada no la lleva: ya entra deslizándose. */}
        <main
          id="contenido"
          key={pathname}
          className={cn("min-w-0 flex-1 p-u3 md:p-u4", conEntrada && "entrada")}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSesion } from "@/lib/auth/SesionContext";
import { etiquetaRol, PERMISOS } from "@/lib/auth/permisos";
import { salir } from "@/lib/api/endpoints/auth";
import { Button } from "@/componentes/ui/button";
import { Marca } from "./Marca";

/**
 * Backoffice municipal. Densidad compacta: quien trabaja acá pasa ocho horas
 * frente a esta pantalla, y cada fila que entra de más es una menos que hay
 * que ir a buscar desplazándose.
 *
 * El menú se arma con los permisos del rol, así que un AUDITOR simplemente no
 * ve las secciones donde no puede hacer nada.
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
  const [menuAbierto, setMenuAbierto] = useState(false);

  const visibles = SECCIONES.filter((s) => !s.permiso || tienePermiso(s.permiso));

  async function cerrar() {
    await salir();
    navegar("/ingresar", { replace: true });
  }

  return (
    <div className="densidad-compacta min-h-screen bg-papel">
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-30 border-b border-borde bg-superficie">
        <div className="flex h-14 items-center gap-u3 px-u3">
          <button
            type="button"
            className="rounded p-1.5 text-apagado hover:bg-papel md:hidden"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuAbierto}
          >
            {menuAbierto ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>

          <Marca />

          <span className="ml-2 hidden rounded bg-expediente-suave px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-expediente sm:inline">
            Gestión interna
          </span>

          <div className="ml-auto flex items-center gap-u2">
            <span className="hidden text-right text-xs leading-tight sm:block">
              <span className="block font-medium text-tinta">{etiquetaRol(rol)}</span>
              <span className="identificador block text-apagado">Legajo {id}</span>
            </span>
            <Button variante="secundario" tamano="chico" onClick={cerrar}>
              <LogOut aria-hidden="true" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Barra lateral */}
        <nav
          aria-label="Secciones"
          className={cn(
            "fixed inset-y-14 left-0 z-20 w-60 shrink-0 overflow-y-auto border-r border-borde bg-superficie p-u2 md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)]",
            menuAbierto ? "block" : "hidden",
          )}
        >
          <ul className="flex flex-col gap-0.5">
            {visibles.map(({ a, icono: Icono, texto, exacto }) => (
              <li key={a}>
                <NavLink
                  to={a}
                  end={exacto}
                  onClick={() => setMenuAbierto(false)}
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

        {menuAbierto && (
          <button
            type="button"
            className="fixed inset-0 top-14 z-10 bg-tinta/20 md:hidden"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        {/* La key hace que la entrada corra una vez por pantalla, no en cada
            render. Sin ella la animación no se vuelve a disparar al navegar. */}
        <main id="contenido" key={pathname} className="entrada min-w-0 flex-1 p-u3 md:p-u4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

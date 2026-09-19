import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSesion } from "@/lib/auth/SesionContext";
import { salir } from "@/lib/api/endpoints/auth";
import { Button } from "@/componentes/ui/button";
import { Marca } from "./Marca";

/**
 * Portal del vecino. Densidad holgada: alguien entra acá dos veces por año,
 * apurado y a menudo desde el teléfono, para resolver una cosa. Es el mismo
 * sistema de diseño que el backoffice con otras medidas — lo único que cambia
 * es la clase de densidad en la raíz.
 *
 * Una persona jurídica ve menos secciones que un ciudadano: el backend no
 * tiene endpoint de perfil ni de grupo familiar para jurídicas.
 */

const SECCIONES = [
  { a: "/portal", texto: "Inicio", exacto: true },
  { a: "/portal/perfil", texto: "Mis datos", soloCiudadano: true },
  { a: "/portal/domicilios", texto: "Domicilios" },
  { a: "/portal/contactos", texto: "Contacto", soloCiudadano: true },
  { a: "/portal/familia", texto: "Grupo familiar", soloCiudadano: true },
  { a: "/portal/organizaciones", texto: "Organizaciones" },
  { a: "/portal/documentos", texto: "Documentos" },
  { a: "/portal/documentacion-solicitada", texto: "Lo que me piden" },
  { a: "/portal/expedientes", texto: "Expedientes" },
];

export function LayoutPortal() {
  const { esCiudadano } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  const visibles = SECCIONES.filter((s) => !s.soloCiudadano || esCiudadano);

  async function cerrar() {
    await salir();
    navegar("/ingresar", { replace: true });
  }

  return (
    <div className="densidad-holgada flex min-h-screen flex-col bg-papel">
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>

      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-u3 px-u2">
          <Marca />
          <Button variante="secundario" tamano="chico" className="ml-auto" onClick={cerrar}>
            <LogOut aria-hidden="true" />
            Salir
          </Button>
        </div>

        <nav aria-label="Secciones" className="mx-auto max-w-5xl px-u2">
          <ul className="-mb-px flex gap-u3 overflow-x-auto">
            {visibles.map(({ a, texto, exacto }) => (
              <li key={a}>
                <NavLink
                  to={a}
                  end={exacto}
                  className={({ isActive }) =>
                    cn(
                      "inline-block whitespace-nowrap border-b-2 px-0.5 py-3 text-[length:var(--texto-dato)] transition-colors duration-150",
                      isActive
                        ? "border-expediente font-semibold text-expediente"
                        : "border-transparent text-apagado hover:text-tinta",
                    )
                  }
                >
                  {texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Ver la nota en LayoutAdmin: la key dispara la entrada por pantalla. */}
      <main
        id="contenido"
        key={pathname}
        className="entrada mx-auto w-full max-w-5xl flex-1 px-u2 py-u4"
      >
        <Outlet />
      </main>

      <footer className="border-t border-borde px-u2 py-u3 text-center text-sm text-apagado">
        Municipalidad de Ciudad UADE · Registro de ciudadanos, organizaciones y expedientes
      </footer>
    </div>
  );
}

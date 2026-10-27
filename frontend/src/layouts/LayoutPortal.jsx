import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSesion } from "@/lib/auth/SesionContext";
import { salir } from "@/lib/api/endpoints/auth";
import { useEmpujon } from "@/lib/movimiento/useEmpujon";
import { Button } from "@/componentes/ui/button";
import { BarraDeGoma, useBarraDeGoma } from "@/componentes/BarraDeGoma";
import { BotonDelMenu, MenuMovil, useMenuMovil } from "@/componentes/MenuMovil";
import { Marca } from "./Marca";
import { htmlDelFantasma } from "./fantasmasPortal";

/**
 * Portal del vecino. Densidad holgada: alguien entra acá dos veces por año,
 * apurado y a menudo desde el teléfono, para resolver una cosa. Es el mismo
 * sistema de diseño que el backoffice con otras medidas — lo único que cambia
 * es la clase de densidad en la raíz.
 *
 * Una ciudadano jurídica ve menos secciones que un ciudadano: el backend no
 * tiene endpoint de perfil ni de grupo familiar para jurídicas.
 *
 * Debajo de `lg` la fila de pestañas ya no entra —necesita unos 1000px—, y en
 * su lugar va el menú del teléfono (`MenuMovil`): la barra queda con la marca y
 * el botón "Menú", y salir pasa adentro del menú.
 */

/* `grupo` es el título bajo el que va cada una en el menú del teléfono. */
const SECCIONES = [
  { a: "/portal", texto: "Inicio", exacto: true, grupo: "Mi legajo" },
  { a: "/portal/perfil", texto: "Mis datos", soloCiudadano: true, grupo: "Mi legajo" },
  { a: "/portal/domicilios", texto: "Domicilios", grupo: "Mi legajo" },
  { a: "/portal/contactos", texto: "Contacto", soloCiudadano: true, grupo: "Mi legajo" },
  { a: "/portal/familia", texto: "Grupo familiar", soloCiudadano: true, grupo: "Mi legajo" },
  { a: "/portal/organizaciones", texto: "Organizaciones", grupo: "Mis trámites" },
  { a: "/portal/documentos", texto: "Documentos", grupo: "Mis trámites" },
  { a: "/portal/documentacion-solicitada", texto: "Lo que me piden", grupo: "Mis trámites" },
  { a: "/portal/expedientes", texto: "Expedientes", grupo: "Mis trámites" },
];

/** Por debajo de `lg` va el menú del teléfono, una columna: el empujón es vertical. */
const ANGOSTO = "(max-width: 1023px)";
const ejeDelMenu = () => (window.matchMedia?.(ANGOSTO).matches ? "y" : "x");

/** Las secciones en grupos, en el orden en que aparecen. */
function agrupar(secciones) {
  const grupos = [];
  for (const s of secciones) {
    if (grupos.at(-1)?.titulo !== s.grupo) grupos.push({ titulo: s.grupo, items: [] });
    grupos.at(-1).items.push(s);
  }
  return grupos;
}

export function LayoutPortal() {
  const { esCiudadano } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const { lista, barra } = useBarraDeGoma("x");
  const menu = useMenuMovil();

  const visibles = SECCIONES.filter((s) => !s.soloCiudadano || esCiudadano);

  /* Cambiar de sección empuja la pantalla hacia el lado de su pestaña, y si
     salta otras pasa por delante de ellas. Ver `useEmpujon.js`. En angosto, en
     vertical: el menú del teléfono es una columna, como el del backoffice. */
  const { alClickear, conEntrada } = useEmpujon({
    secciones: visibles,
    eje: ejeDelMenu,
    fantasma: htmlDelFantasma,
    densidad: "densidad-holgada",
  });

  async function cerrar() {
    await salir();
    navegar("/ingresar", { replace: true });
  }

  return (
    <div className="densidad-holgada flex min-h-screen flex-col bg-papel" onClickCapture={alClickear}>
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>

      {/* En angosto la cabecera queda pegada arriba y por encima del menú: el
          botón no se mueve al abrirlo. */}
      <header data-cabecera="" className="sticky top-0 z-30 border-b border-borde bg-superficie lg:static">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-u3 px-u2 lg:h-16">
          <Marca />
          <Button
            variante="secundario"
            tamano="chico"
            className="ml-auto hidden lg:inline-flex"
            onClick={cerrar}
          >
            <LogOut aria-hidden="true" />
            Salir
          </Button>
          <BotonDelMenu menu={menu} className="ml-auto lg:hidden" />
        </div>

        <nav aria-label="Secciones" className="mx-auto hidden max-w-5xl px-u2 lg:block">
          {/* La pestaña activa la marca una sola barra que viaja entre ellas
              (`BarraDeGoma`), no un borde por pestaña. */}
          <ul ref={lista} className="relative -mb-px flex gap-u3 overflow-x-auto">
            {visibles.map((seccion) => (
              <li key={seccion.a}>
                <NavLink
                  to={seccion.a}
                  end={seccion.exacto}
                  /* Todas en negrita, no sólo la activa: si el peso cambiara al
                     activarse, la pestaña cambiaría de ancho y correría a las de
                     al lado. La activa la marcan el color y la barra. */
                  className={({ isActive }) =>
                    cn(
                      "inline-block whitespace-nowrap px-0.5 py-3 text-[length:var(--texto-dato)] font-semibold",
                      "transition-colors duration-[400ms] ease-[var(--ease-morph)]",
                      isActive ? "text-expediente" : "text-apagado hover:text-tinta",
                    )
                  }
                >
                  {seccion.texto}
                </NavLink>
              </li>
            ))}
            <BarraDeGoma refBarra={barra} como="li" />
          </ul>
        </nav>
      </header>

      {/* Afuera de la cabecera: abierto, se va con la foto vieja en el empujón. */}
      <MenuMovil
        menu={menu}
        className="lg:hidden"
        grupos={agrupar(visibles)}
        pie={
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
        }
      />

      {/* Ver la nota en LayoutAdmin: la key dispara la entrada por pantalla. */}
      <main
        id="contenido"
        key={pathname}
        className={cn("mx-auto w-full max-w-5xl flex-1 px-u2 py-u4", conEntrada && "entrada")}
      >
        <Outlet />
      </main>

      {/* Se queda quieto en el cambio de sección, como la cabecera: no es de
          ninguna pantalla. Lleva el fondo del papel para que la tira pase por
          detrás sin verse a través del texto. */}
      <footer
        data-pie=""
        className="border-t border-borde bg-papel px-u2 py-u3 text-center text-sm text-apagado"
      >
        Municipalidad de Ciudad UADE · Registro de ciudadanos, organizaciones y expedientes
      </footer>
    </div>
  );
}

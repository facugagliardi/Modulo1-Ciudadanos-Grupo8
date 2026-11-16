import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEmpujon } from "@/lib/movimiento/useEmpujon";
import { Marca } from "./Marca";

/*
 * Ingresar y Registro son dos caras de la misma puerta: van una arriba de la
 * otra. Pasar de una a otra empuja la pantalla en vertical —Registro queda
 * abajo: ir a crear la cuenta sube Ingresar y trae Registro desde abajo—, con
 * el mismo empujón del portal. El resto de las rutas públicas (404, sin
 * permiso) no tienen lugar en la columna y se resuelven en seco.
 */
const PUERTAS = [
  { a: "/ingresar", texto: "Ingresar" },
  { a: "/registro", texto: "Crear cuenta" },
];

/* Son vecinas: el empujón nunca pasa por delante de otra pantalla. */
const sinFantasma = () => "";

export function LayoutPublico() {
  const { pathname } = useLocation();
  const { alClickear, conEntrada } = useEmpujon({
    secciones: PUERTAS,
    eje: "y",
    fantasma: sinFantasma,
    densidad: "densidad-holgada",
  });

  return (
    <div className="densidad-holgada flex min-h-screen flex-col bg-papel" onClickCapture={alClickear}>
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>

      {/* La marca y el pie se quedan quietos en el empujón: no son de ninguna
          de las dos pantallas. */}
      <header data-cabecera="" className="px-u3 py-u3">
        <Marca />
      </header>

      <main
        id="contenido"
        key={pathname}
        className={cn("flex flex-1 items-start justify-center px-u2 pb-u5", conEntrada && "entrada")}
      >
        <Outlet />
      </main>

      <footer data-pie="" className="bg-papel px-u3 py-u3 text-sm text-apagado">
        Municipalidad de Ciudad UADE
      </footer>
    </div>
  );
}

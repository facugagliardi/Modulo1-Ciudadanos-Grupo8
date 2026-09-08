import { Outlet } from "react-router-dom";
import { Marca } from "./Marca";

export function LayoutPublico() {
  return (
    <div className="densidad-holgada flex min-h-screen flex-col bg-papel">
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>

      <header className="px-u3 py-u3">
        <Marca />
      </header>

      <main id="contenido" className="flex flex-1 items-start justify-center px-u2 pb-u5">
        <Outlet />
      </main>

      <footer className="px-u3 py-u3 text-sm text-apagado">
        Municipalidad de Ciudad UADE
      </footer>
    </div>
  );
}

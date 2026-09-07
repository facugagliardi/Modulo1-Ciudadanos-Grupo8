import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProveedorDeSesion } from "@/lib/auth/SesionContext";
import { abrirSesion, cerrarSesion } from "@/lib/auth/almacen";
import { jwtFalso } from "./jwt";

/** Deja una sesión abierta antes de renderizar, como si el usuario hubiera entrado. */
export function conSesion({ id = 1, rol = "RESPONSABLE_AREA", subType = "EMPLEADO" } = {}) {
  abrirSesion({
    accessToken: jwtFalso({ sub: String(id), rol, sub_type: subType }),
    refreshToken: "refresh",
    cuerpo: {},
  });
}

export function sinSesion() {
  cerrarSesion();
}

/**
 * Renderiza con router y sesión. `ruta` es la URL inicial y `patron` el patrón
 * de la ruta, para las pantallas que leen useParams.
 */
export function renderizar(ui, { ruta = "/", patron } = {}) {
  return render(
    <ProveedorDeSesion>
      <MemoryRouter
        initialEntries={[ruta]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {patron ? (
          <Routes>
            <Route path={patron} element={ui} />
          </Routes>
        ) : (
          ui
        )}
      </MemoryRouter>
    </ProveedorDeSesion>,
  );
}

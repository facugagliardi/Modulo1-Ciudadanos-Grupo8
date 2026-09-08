import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequierePermiso, RutaDeZona, RutaProtegida } from "./guardas";
import { ProveedorDeSesion } from "@/lib/auth/SesionContext";
import { PERMISOS } from "@/lib/auth/permisos";
import { conSesion, sinSesion } from "@/pruebas/utilidades";
import { SinPermiso } from "@/paginas/errores/Errores";

/**
 * Las guardas no protegen datos (eso lo hace el backend): evitan que alguien
 * llegue a una pantalla que no puede usar y se coma un error.
 */
function app(ruta) {
  return render(
    <ProveedorDeSesion>
      <MemoryRouter
        initialEntries={[ruta]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/ingresar" element={<p>Pantalla de ingreso</p>} />
          <Route path="/sin-permiso" element={<SinPermiso />} />
          <Route path="/portal" element={<p>Portal del vecino</p>} />

          <Route element={<RutaProtegida />}>
            <Route element={<RutaDeZona zona="admin" />}>
              <Route path="/admin" element={<p>Backoffice</p>} />
              {/* EDITAR_TERCEROS lo tienen los tres roles de carga pero no
                  el auditor: sirve para probar los dos caminos con roles reales. */}
              <Route
                path="/admin/padron/nuevo"
                element={
                  <RequierePermiso permiso={PERMISOS.EDITAR_TERCEROS}>
                    <p>Alta de vecino</p>
                  </RequierePermiso>
                }
              />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </ProveedorDeSesion>,
  );
}

describe("RutaProtegida", () => {
  it("manda al ingreso si no hay sesión", () => {
    sinSesion();
    app("/admin");
    expect(screen.getByText("Pantalla de ingreso")).toBeInTheDocument();
  });

  it("deja pasar si hay sesión", () => {
    conSesion({ rol: "RESPONSABLE_AREA", subType: "EMPLEADO" });
    app("/admin");
    expect(screen.getByText("Backoffice")).toBeInTheDocument();
  });
});

describe("RutaDeZona", () => {
  it("un vecino que entra al backoffice va a su portal", () => {
    conSesion({ rol: "PERSONA", subType: "CIUDADANO" });
    app("/admin");
    expect(screen.getByText("Portal del vecino")).toBeInTheDocument();
  });

  it("un empleado sí entra al backoffice", () => {
    conSesion({ rol: "MESA_ENTRADAS", subType: "EMPLEADO" });
    app("/admin");
    expect(screen.getByText("Backoffice")).toBeInTheDocument();
  });
});

describe("RequierePermiso", () => {
  it("deja pasar a quien tiene el permiso", () => {
    conSesion({ rol: "MESA_ENTRADAS", subType: "EMPLEADO" });
    app("/admin/padron/nuevo");
    expect(screen.getByText("Alta de vecino")).toBeInTheDocument();
  });

  it("desvía a una pantalla que explica qué permiso faltó", () => {
    // El 403 del backend dice qué rol tenés y qué permiso falta; la pantalla
    // mantiene el mismo criterio en vez de un "no autorizado" pelado.
    conSesion({ rol: "AUDITOR", subType: "EMPLEADO" });
    app("/admin/padron/nuevo");

    expect(screen.getByText(/no tenés acceso a esta sección/i)).toBeInTheDocument();
    expect(screen.getByText("EDITAR_TERCEROS")).toBeInTheDocument();
    expect(screen.getByText("Auditor")).toBeInTheDocument();
  });
});

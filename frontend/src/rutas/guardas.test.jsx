import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequierePermiso, RutaDeZona, RutaProtegida, SoloCiudadano } from "./guardas";
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
            <Route element={<RutaDeZona zona="portal" />}>
              <Route path="/portal/inicio" element={<p>Inicio privado del vecino</p>} />
              <Route element={<SoloCiudadano />}>
                <Route path="/portal/familia" element={<p>Mi grupo familiar</p>} />
              </Route>
              <Route path="/portal/perfil" element={<SoloCiudadano><p>Mi perfil físico</p></SoloCiudadano>} />
            </Route>
            <Route element={<RutaDeZona zona="admin" />}>
              <Route element={<RequierePermiso permiso={PERMISOS.EDITAR_TERCEROS} />}>
                <Route path="/admin/edicion" element={<p>Edición autorizada</p>} />
              </Route>
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
  it("redirige al empleado que entra en el portal a su backoffice", () => {
    conSesion({ rol: "MESA_ENTRADAS", subType: "EMPLEADO" });
    app("/portal/inicio");
    expect(screen.getByText("Backoffice")).toBeInTheDocument();
  });

  it("deja al ciudadano entrar a su portal", () => {
    conSesion({ rol: "PERSONA", subType: "CIUDADANO" });
    app("/portal/inicio");
    expect(screen.getByText("Inicio privado del vecino")).toBeInTheDocument();
  });
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
  it("protege también las rutas anidadas sin contenido directo", () => {
    conSesion({ rol: "MESA_ENTRADAS", subType: "EMPLEADO" });
    app("/admin/edicion");
    expect(screen.getByText("Edición autorizada")).toBeInTheDocument();
  });
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

describe("SoloCiudadano", () => {
  it.each([
    ["/portal/familia", "Mi grupo familiar"],
    ["/portal/perfil", "Mi perfil físico"],
  ])("permite al ciudadano físico abrir %s", (ruta, contenido) => {
    conSesion({ rol: "PERSONA", subType: "CIUDADANO" });
    app(ruta);
    expect(screen.getByText(contenido)).toBeInTheDocument();
  });

  it("evita abrir el grupo familiar de una persona jurídica", () => {
    conSesion({ rol: "ORGANIZACION", subType: "ORGANIZACION" });
    app("/portal/familia");
    expect(screen.getByText("Portal del vecino")).toBeInTheDocument();
    expect(screen.queryByText("Mi grupo familiar")).not.toBeInTheDocument();
  });
});

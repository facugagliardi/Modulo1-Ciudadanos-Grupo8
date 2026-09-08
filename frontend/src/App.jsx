import { Navigate, Route, Routes } from "react-router-dom";
import { ProveedorDeSesion, useSesion } from "@/lib/auth/SesionContext";
import { RequierePermiso, RutaDeZona, RutaProtegida, SoloCiudadano } from "@/rutas/guardas";
import { PERMISOS } from "@/lib/auth/permisos";

import { LayoutPublico } from "@/layouts/LayoutPublico";
import { LayoutPortal } from "@/layouts/LayoutPortal";
import { LayoutAdmin } from "@/layouts/LayoutAdmin";

import { Ingresar } from "@/paginas/publico/Ingresar";
import { Registro } from "@/paginas/publico/Registro";
import { MisTramites } from "@/paginas/portal/MisTramites";
import { Perfil } from "@/paginas/portal/Perfil";
import { Domicilios } from "@/paginas/portal/Domicilios";
import { Contactos } from "@/paginas/portal/Contactos";
import { Familia } from "@/paginas/portal/Familia";
import { MisExpedientes } from "@/paginas/portal/MisExpedientes";
import { Expedientes } from "@/paginas/admin/Expedientes";
import { NuevoExpediente } from "@/paginas/admin/NuevoExpediente";
import { DetalleExpediente } from "@/paginas/expediente/DetalleExpediente";
import { MisDocumentos } from "@/paginas/portal/MisDocumentos";
import { DocumentacionSolicitada } from "@/paginas/portal/DocumentacionSolicitada";
import { Documentacion } from "@/paginas/admin/Documentacion";
import { Tablero } from "@/paginas/admin/Tablero";
import { AltaDeVecino } from "@/paginas/admin/AltaDeVecino";
import { Organizaciones } from "@/paginas/admin/Organizaciones";
import { MisOrganizaciones } from "@/paginas/portal/MisOrganizaciones";
import { NuevaOrganizacion } from "@/paginas/organizacion/NuevaOrganizacion";
import { DetalleOrganizacion } from "@/paginas/organizacion/DetalleOrganizacion";
import { Padron } from "@/paginas/admin/Padron";
import { LegajoVecino } from "@/paginas/admin/LegajoVecino";
// `EnConstruccion` ya no se importa: todas las rutas del sitemap están hechas.
// El componente sigue en paginas/errores para cuando se sume otra sección.
import { NoEncontrado, SinPermiso } from "@/paginas/errores/Errores";

/** La raíz manda a cada uno a su casa según el tipo de sujeto del token. */
function Inicio() {
  const { autenticado, esEmpleado } = useSesion();
  if (!autenticado) return <Navigate to="/ingresar" replace />;
  return <Navigate to={esEmpleado ? "/admin" : "/portal"} replace />;
}

export function App() {
  return (
    <ProveedorDeSesion>
      <Routes>
        <Route path="/" element={<Inicio />} />

        {/* --- Público --- */}
        <Route element={<LayoutPublico />}>
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="*" element={<NoEncontrado />} />
        </Route>

        {/* --- Con sesión --- */}
        <Route element={<RutaProtegida />}>
          <Route path="/sin-permiso" element={<LayoutPublico />}>
            <Route index element={<SinPermiso />} />
          </Route>

          {/* Portal del vecino */}
          <Route element={<RutaDeZona zona="portal" />}>
            <Route path="/portal" element={<LayoutPortal />}>
              <Route index element={<MisTramites />} />
              <Route path="domicilios" element={<Domicilios />} />

              {/* El backend no tiene endpoints de perfil ni de familia para
                  personas jurídicas: ver sitemap.md, sección 6. */}
              <Route
                path="perfil"
                element={
                  <SoloCiudadano>
                    <Perfil />
                  </SoloCiudadano>
                }
              />
              <Route
                path="contactos"
                element={
                  <SoloCiudadano>
                    <Contactos />
                  </SoloCiudadano>
                }
              />
              <Route
                path="familia"
                element={
                  <SoloCiudadano>
                    <Familia />
                  </SoloCiudadano>
                }
              />
              <Route path="organizaciones" element={<MisOrganizaciones />} />
              <Route path="organizaciones/nueva" element={<NuevaOrganizacion zona="portal" />} />
              <Route path="organizaciones/:id" element={<DetalleOrganizacion zona="portal" />} />
              <Route path="documentos" element={<MisDocumentos />} />
              <Route path="documentacion-solicitada" element={<DocumentacionSolicitada />} />
              <Route path="expedientes" element={<MisExpedientes />} />
              <Route path="expedientes/:id" element={<DetalleExpediente zona="portal" />} />
              <Route path="*" element={<NoEncontrado />} />
            </Route>
          </Route>

          {/* Backoffice */}
          <Route element={<RutaDeZona zona="admin" />}>
            <Route path="/admin" element={<LayoutAdmin />}>
              <Route
                index
                element={
                  <RequierePermiso permiso={PERMISOS.LISTAR_PADRON}>
                    <Tablero />
                  </RequierePermiso>
                }
              />

              <Route
                path="padron"
                element={
                  <RequierePermiso permiso={PERMISOS.LISTAR_PADRON}>
                    <Padron />
                  </RequierePermiso>
                }
              />
              <Route
                path="padron/nuevo"
                element={
                  <RequierePermiso permiso={PERMISOS.EDITAR_TERCEROS}>
                    <AltaDeVecino />
                  </RequierePermiso>
                }
              />
              <Route
                path="padron/:id"
                element={
                  <RequierePermiso permiso={PERMISOS.LEER_TERCEROS}>
                    <LegajoVecino />
                  </RequierePermiso>
                }
              />

              <Route path="organizaciones" element={<Organizaciones />} />
              <Route path="organizaciones/nueva" element={<NuevaOrganizacion zona="admin" />} />
              <Route path="organizaciones/:id" element={<DetalleOrganizacion zona="admin" />} />
              <Route
                path="documentacion"
                element={
                  <RequierePermiso permiso={PERMISOS.LEER_TERCEROS}>
                    <Documentacion />
                  </RequierePermiso>
                }
              />
              <Route
                path="expedientes"
                element={
                  <RequierePermiso permiso={PERMISOS.LEER_TERCEROS}>
                    <Expedientes />
                  </RequierePermiso>
                }
              />
              <Route
                path="expedientes/nuevo"
                element={
                  <RequierePermiso permiso={PERMISOS.GESTIONAR_EXPEDIENTES}>
                    <NuevoExpediente />
                  </RequierePermiso>
                }
              />
              <Route
                path="expedientes/:id"
                element={
                  <RequierePermiso permiso={PERMISOS.LEER_TERCEROS}>
                    <DetalleExpediente zona="admin" />
                  </RequierePermiso>
                }
              />
              <Route path="*" element={<NoEncontrado />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </ProveedorDeSesion>
  );
}

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSesion } from "@/lib/auth/SesionContext";

/**
 * Las guardas no son seguridad: el backend valida igual y devuelve 401/403.
 * Sirven para que nadie llegue a una pantalla que no puede usar y se coma un
 * error, y para cumplir el requisito de "mostrar las operaciones disponibles
 * según el rol autenticado".
 */

/** Hay sesión. Si no, al login, recordando a dónde quería ir. */
export function RutaProtegida() {
  const { autenticado } = useSesion();
  const ubicacion = useLocation();

  if (!autenticado) {
    return <Navigate to="/ingresar" replace state={{ destino: ubicacion.pathname }} />;
  }
  return <Outlet />;
}

/**
 * La zona correcta. Un empleado no tiene por qué ver el portal del vecino ni
 * al revés: cada uno va a su casa.
 */
export function RutaDeZona({ zona }) {
  const { esEmpleado } = useSesion();
  const leCorresponde = zona === "admin" ? esEmpleado : !esEmpleado;

  if (!leCorresponde) {
    return <Navigate to={esEmpleado ? "/admin" : "/portal"} replace />;
  }
  return <Outlet />;
}

/**
 * Pantallas que sólo existen para una persona física.
 *
 * El backend no tiene endpoint de perfil ni de grupo familiar para personas
 * jurídicas: `GET /ciudadanos/{id}` resuelve contra el repositorio de
 * ciudadanos y a una jurídica le devuelve 404. En vez de mostrarle una pantalla
 * rota, se la manda a su inicio. Ver sitemap.md, sección 6.
 */
export function SoloCiudadano({ children }) {
  const { esCiudadano } = useSesion();
  if (!esCiudadano) return <Navigate to="/portal" replace />;
  return children ?? <Outlet />;
}

/** Un permiso concreto de la matriz de roles. Si falta, 403 explicado. */
export function RequierePermiso({ permiso, children }) {
  const { tienePermiso } = useSesion();
  if (!tienePermiso(permiso)) {
    return <Navigate to="/sin-permiso" replace state={{ permiso }} />;
  }
  return children ?? <Outlet />;
}

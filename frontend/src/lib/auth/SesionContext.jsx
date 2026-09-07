import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { obtenerSesion, suscribirse } from "./almacen";
import { esEmpleado, puede } from "./permisos";

const Contexto = createContext(null);

/**
 * Expone la sesion a la app. Se suscribe al almacen en vez de tener su propio
 * estado, asi el interceptor de refresh del cliente HTTP puede rotar los
 * tokens sin pasar por React y la UI se entera igual.
 */
export function ProveedorDeSesion({ children }) {
  const sesion = useSyncExternalStore(suscribirse, obtenerSesion, () => null);

  const tienePermiso = useCallback(
    (permiso) => (sesion ? puede(sesion.rol, permiso) : false),
    [sesion],
  );

  const valor = useMemo(
    () => ({
      sesion,
      autenticado: Boolean(sesion?.accessToken),
      id: sesion?.id ?? null,
      rol: sesion?.rol ?? null,
      subType: sesion?.subType ?? null,
      esEmpleado: esEmpleado(sesion?.rol),
      esCiudadano: sesion?.subType === "CIUDADANO",
      esJuridica: sesion?.subType === "JURIDICA",
      tienePermiso,
    }),
    [sesion, tienePermiso],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useSesion tiene que usarse dentro de <ProveedorDeSesion>");
  return valor;
}

/** Azucar para condicionar un boton: `const puedeEditar = usePermiso("EDITAR_TERCEROS")`. */
export function usePermiso(permiso) {
  return useSesion().tienePermiso(permiso);
}

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { olvidarUltimosDatos } from "@/componentes/Esqueleto";
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

  /* Los moldes de carga recuerdan lo último que se vio (`useUltimosDatos`).
     Cuando cambia quién está —se cierra la sesión, entra otra persona— se
     olvida todo: el esqueleto de alguien no se arma con lo que vio otro. La
     rotación de tokens no cuenta: es la misma persona. */
  const quien = sesion ? `${sesion.subType}:${sesion.id}` : null;
  useEffect(() => olvidarUltimosDatos, [quien]);

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

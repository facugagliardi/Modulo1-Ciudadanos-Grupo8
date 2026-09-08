/**
 * Guarda la sesion y notifica a quien la escuche.
 *
 * Vive fuera de React a proposito: el cliente HTTP necesita leer y rotar los
 * tokens sin depender de un hook, y el contexto de React se suscribe aca. Si
 * el token viviera solo en un estado de React, el interceptor de refresh
 * tendria que importar el arbol de componentes.
 *
 * Sobre localStorage: es vulnerable a XSS. Para el alcance del TPO es lo
 * razonable (el backend no emite cookies y expone los tokens por CORS
 * justamente para que el front los lea). Si mas adelante hace falta endurecer
 * esto, el cambio queda contenido en este archivo.
 */

const CLAVE = "m1.sesion";

let estado = leerDeDisco();
const oyentes = new Set();

function leerDeDisco() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

function guardarEnDisco(valor) {
  try {
    if (valor) localStorage.setItem(CLAVE, JSON.stringify(valor));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Modo privado o storage lleno: la sesion sigue viva en memoria.
  }
}

function avisar() {
  oyentes.forEach((fn) => fn());
}

/** Decodifica el payload de un JWT. No valida la firma: eso es del backend. */
export function decodificarJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Arma la sesion a partir de los tokens y del cuerpo que devolvio el login.
 * Los claims mandan: `sub` es el id, `sub_type` decide la zona, `rol` decide
 * los permisos.
 */
export function abrirSesion({ accessToken, refreshToken, cuerpo = {} }) {
  const claims = decodificarJwt(accessToken) ?? {};
  estado = {
    accessToken,
    refreshToken,
    id: claims.sub ? Number(claims.sub) : null,
    subType: claims.sub_type ?? null, // CIUDADANO | JURIDICA | EMPLEADO | SERVICIO
    rol: claims.rol ?? cuerpo.rol ?? null,
    expira: claims.exp ?? null,
    cuerpo,
  };
  guardarEnDisco(estado);
  avisar();
  return estado;
}

/** Rota el par de tokens conservando la identidad. Lo usa el refresh. */
export function rotarTokens({ accessToken, refreshToken }) {
  if (!estado) return null;
  const claims = decodificarJwt(accessToken) ?? {};
  estado = {
    ...estado,
    accessToken,
    refreshToken: refreshToken ?? estado.refreshToken,
    expira: claims.exp ?? estado.expira,
  };
  guardarEnDisco(estado);
  avisar();
  return estado;
}

export function cerrarSesion() {
  estado = null;
  guardarEnDisco(null);
  avisar();
}

export function obtenerSesion() {
  return estado;
}

export function obtenerAccessToken() {
  return estado?.accessToken ?? null;
}

export function obtenerRefreshToken() {
  return estado?.refreshToken ?? null;
}

/** Para useSyncExternalStore. */
export function suscribirse(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

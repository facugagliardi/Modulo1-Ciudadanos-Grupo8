/**
 * El unico lugar del front que habla con el backend.
 *
 * Resuelve tres cosas que si se resolvieran pantalla por pantalla serian
 * inconsistentes:
 *
 *   1. Los tokens viajan en HEADERS, nunca en el cuerpo. El login devuelve
 *      Authorization / X-Refresh-Token / X-Token-Expires-In, expuestos por CORS.
 *   2. El access token dura 15 minutos. Ante un 401 se intenta UN refresh y se
 *      reintenta el pedido original. Si varios pedidos fallan a la vez, comparten
 *      el mismo refresh (si no, cada uno rotaria el token y se pisarian).
 *   3. Todos los errores del backend salen con la misma forma, asi que se
 *      normalizan a un solo tipo y las pantallas no parsean nada.
 */

import {
  abrirSesion,
  cerrarSesion,
  obtenerAccessToken,
  obtenerRefreshToken,
  rotarTokens,
} from "../auth/almacen";

export const BASE = String(
  import.meta.env?.VITE_API_URL ?? "http://localhost:8080",
).replace(/\/+$/, "");

/** Error normalizado. Todo lo que tira este modulo es un ErrorApi. */
export class ErrorApi extends Error {
  constructor({ status, message, errores = null, path = null }) {
    super(message || "Error inesperado");
    this.name = "ErrorApi";
    this.status = status;
    /** Mapa campo -> motivo. Solo viene en los 400 de Bean Validation. */
    this.errores = errores;
    this.path = path;
  }

  /** true si el 400 trae detalle campo por campo para pintar el formulario. */
  get tieneErroresDeCampo() {
    return Boolean(this.errores && Object.keys(this.errores).length > 0);
  }
}

function leerTokensDeHeaders(res) {
  const autorizacion = res.headers.get("Authorization") ?? res.headers.get("authorization");
  return {
    accessToken: autorizacion ? autorizacion.replace(/^Bearer\s+/i, "") : null,
    refreshToken: res.headers.get("X-Refresh-Token") ?? res.headers.get("x-refresh-token"),
    expiraEn: Number(res.headers.get("X-Token-Expires-In") ?? 0) || null,
  };
}

async function leerCuerpo(res) {
  if (res.status === 204) return null;
  const texto = await res.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

async function comoError(res) {
  const cuerpo = await leerCuerpo(res);
  if (cuerpo && typeof cuerpo === "object") {
    return new ErrorApi({
      status: res.status,
      message: cuerpo.message,
      errores: cuerpo.errores ?? null,
      path: cuerpo.path ?? null,
    });
  }
  return new ErrorApi({ status: res.status, message: typeof cuerpo === "string" ? cuerpo : null });
}

// --- Refresh compartido -----------------------------------------------------
// Si cinco pedidos reciben 401 al mismo tiempo, todos esperan el mismo refresh.
let refrescoEnCurso = null;

async function refrescarSesion() {
  const refreshToken = obtenerRefreshToken();
  if (!refreshToken) return false;

  if (!refrescoEnCurso) {
    refrescoEnCurso = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        // Devuelve 204 sin cuerpo; los tokens nuevos vienen en los headers y
        // rota el par completo, asi que hay que guardar tambien el refresh.
        const tokens = leerTokensDeHeaders(res);
        if (!tokens.accessToken) return false;
        rotarTokens(tokens);
        return true;
      } catch {
        return false;
      } finally {
        refrescoEnCurso = null;
      }
    })();
  }
  return refrescoEnCurso;
}

/**
 * Hace un pedido al backend.
 *
 * @param {string} ruta      "/ciudadanos/3"
 * @param {object} opciones
 *   metodo    "GET" por defecto
 *   cuerpo    objeto que se serializa a JSON
 *   form      FormData; si viene, NO se fija Content-Type (lo pone el browser
 *             con su boundary)
 *   sinAuth   true para /auth/login y /auth/register
 *   _reintento uso interno del refresh
 */
export async function pedir(ruta, opciones = {}) {
  const {
    metodo = "GET",
    cuerpo,
    form,
    sinAuth = false,
    senal,
    comoBlob = false,
    _reintento = false,
  } = opciones;

  const headers = {};
  if (!sinAuth) {
    const token = obtenerAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (cuerpo !== undefined && !form) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers,
      body: form ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
      signal: senal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ErrorApi({
      status: 0,
      message: "No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.",
    });
  }

  // 401: un solo intento de refresh, y se repite el pedido original.
  if (res.status === 401 && !sinAuth && !_reintento) {
    const seRenovo = await refrescarSesion();
    if (seRenovo) return pedir(ruta, { ...opciones, _reintento: true });
    cerrarSesion();
    throw new ErrorApi({ status: 401, message: "Tu sesión venció. Ingresá de nuevo." });
  }

  if (!res.ok) throw await comoError(res);
  return comoBlob ? res.blob() : leerCuerpo(res);
}

/**
 * Como `pedir`, pero devuelve tambien los headers. Lo usan login y register,
 * que son los unicos a los que les importan los tokens.
 */
export async function pedirConTokens(ruta, opciones = {}) {
  const { metodo = "POST", cuerpo } = opciones;
  let res;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi({
      status: 0,
      message: "No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.",
    });
  }
  if (!res.ok) throw await comoError(res);
  return { cuerpo: await leerCuerpo(res), tokens: leerTokensDeHeaders(res) };
}

/** Login: guarda la sesion con lo que vino en el cuerpo y en los headers. */
export async function autenticar(ruta, credenciales) {
  const { cuerpo, tokens } = await pedirConTokens(ruta, { cuerpo: credenciales });
  if (!tokens.accessToken) {
    throw new ErrorApi({
      status: 500,
      message: "El servidor no devolvió el token de sesión.",
    });
  }
  return abrirSesion({ ...tokens, cuerpo: cuerpo ?? {} });
}

export const get = (ruta, senal) => pedir(ruta, { senal });
/**
 * Para binarios: devuelve un Blob en vez de JSON.
 *
 * Hace falta porque `<img src>` y `<iframe src>` no mandan headers, así que no
 * pueden llevar el token. Se pide el archivo por acá —con Authorization y con
 * el refresh automático de `pedir`— y recién después se arma un `blob:` URL
 * para dárselo al elemento.
 */
export const getBlob = (ruta, senal) => pedir(ruta, { senal, comoBlob: true });
export const post = (ruta, cuerpo) => pedir(ruta, { metodo: "POST", cuerpo });
export const put = (ruta, cuerpo) => pedir(ruta, { metodo: "PUT", cuerpo });
export const patch = (ruta, cuerpo) => pedir(ruta, { metodo: "PATCH", cuerpo });
export const del = (ruta) => pedir(ruta, { metodo: "DELETE" });

/**
 * Traduce el mensaje del backend a algo que le sirva a la persona.
 *
 * Los mensajes de "campo no permitido" y "valor invalido en enum" son bugs
 * NUESTROS, no errores del usuario: si aparecen, mandamos un campo de mas.
 * Se muestran genericos y se loguean.
 */
export function mensajeAmable(error) {
  if (!(error instanceof ErrorApi)) return "Ocurrió un error inesperado.";
  const m = error.message ?? "";

  if (/Campo no permitido|Valor invalido en/i.test(m)) {
    console.error("[bug del front] el backend rechazó el cuerpo enviado:", m);
    return "No pudimos procesar el formulario. Avisale al equipo técnico.";
  }
  if (error.status === 401) return "Tu sesión venció. Ingresá de nuevo.";
  if (error.status === 403) return m || "No tenés permiso para hacer esto.";
  if (error.status === 404) return m || "No encontramos lo que buscabas.";
  if (error.status === 413) return "El archivo no puede superar los 10 MB.";
  if (error.status === 500) return "El servidor tuvo un problema. Probá de nuevo en un momento.";
  if (error.status === 0) return m;
  return m || "No pudimos completar la operación.";
}

/** Arma un JWT de mentira con los claims que quieras. La firma no importa: el front no la valida. */
export function jwtFalso(claims = {}) {
  const base = { iss: "modulo1-ciudadanos", typ: "access", ...claims };
  const b64 = (o) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64(base)}.firmafalsa`;
}

/** Respuesta de login: cuerpo vacío y los tokens en los headers, como el backend real. */
export function respuestaDeLogin({ cuerpo = {}, access, refresh = "refresh-1", expira = 900 }) {
  return new Response(JSON.stringify(cuerpo), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
      "X-Refresh-Token": refresh,
      "X-Token-Expires-In": String(expira),
    },
  });
}

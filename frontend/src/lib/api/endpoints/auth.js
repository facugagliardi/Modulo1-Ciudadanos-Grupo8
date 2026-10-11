import { autenticar, pedir, post } from "../cliente";
import { cuerpo } from "../campos";
import { cerrarSesion } from "../../auth/almacen";
import { soloDigitos } from "../../dominio/formato";

/** Login de ciudadanos (ciudadanos y juridicas). Acepta CUIT o CUIL. */
export function ingresar({ cuit, password }) {
  return autenticar("/auth/login", cuerpo("login", { cuit: soloDigitos(cuit), password }));
}

/** Login de empleados municipales. Se identifican con mail, no con CUIT. */
export function ingresarEmpleado({ mail, password }) {
  return autenticar("/auth/empleados/login", cuerpo("loginEmpleado", { mail, password }));
}

/**
 * Alta de ciudadano. `POST /auth/register` NO devuelve tokens, asi que se
 * encadena el login: el usuario completa un formulario y queda adentro.
 */
export async function registrarYEntrar(datos) {
  const ciudadano = await registrarCiudadano(datos);
  const sesion = await ingresar({ cuit: datos.cuit, password: datos.password });
  return { ciudadano, sesion };
}

/**
 * Alta de ciudadano SIN tocar la sesion.
 *
 * La usa el alta asistida del backoffice: un empleado registra a un vecino y
 * tiene que seguir siendo el mismo. Encadenar el login aca lo sacaria de su
 * propia sesion y lo dejaria dentro de la cuenta del vecino.
 */
export function registrarCiudadano(datos) {
  return post("/auth/register", cuerpo("registrarCiudadano", { ...datos, cuit: soloDigitos(datos.cuit) }));
}

/**
 * Cierra la sesion. El backend responde 204 pero no revoca nada (los tokens
 * son stateless y no hay denylist), asi que lo que realmente corta el acceso
 * es descartarlos de este lado.
 */
export async function salir() {
  try {
    await pedir("/auth/logout", { metodo: "POST" });
  } catch {
    // Da igual: lo importante es lo de abajo.
  }
  cerrarSesion();
}

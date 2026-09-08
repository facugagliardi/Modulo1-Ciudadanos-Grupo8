/**
 * Formateo de lo que se muestra en pantalla.
 *
 * Regla general: el backend devuelve los identificadores normalizados (CUIT de
 * 11 digitos sin guiones, telefonos sin espacios). Nunca mostramos lo que
 * escribio el usuario, siempre lo que devolvio el servidor, formateado aca.
 * Si no, la pantalla y la base divergen.
 */

/** 20345678901 -> "20-34567890-1" */
export function formatearCuit(cuit) {
  if (!cuit) return "";
  const digitos = String(cuit).replace(/\D/g, "");
  if (digitos.length !== 11) return String(cuit);
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}

/** 34567890 -> "34.567.890" */
export function formatearDni(dni) {
  if (!dni) return "";
  const digitos = String(dni).replace(/\D/g, "");
  if (!digitos) return String(dni);
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Quita guiones y espacios: lo que el backend espera recibir. */
export function soloDigitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

/** "1989-04-12" -> "12/04/1989". No usa Date para no correrse por zona horaria. */
export function formatearFecha(iso) {
  if (!iso) return "";
  const [fecha] = String(iso).split("T");
  const partes = fecha.split("-");
  if (partes.length !== 3) return String(iso);
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

/** ISO con offset -> "12/04/1989 14:30" */
export function formatearFechaHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${formatearFecha(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** Años cumplidos a hoy. Devuelve null si no hay fecha. */
export function edad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const [anio, mes, dia] = String(fechaNacimiento).split("-").map(Number);
  if (!anio) return null;
  const hoy = new Date();
  let años = hoy.getFullYear() - anio;
  const cumplioEsteAnio =
    hoy.getMonth() + 1 > mes || (hoy.getMonth() + 1 === mes && hoy.getDate() >= dia);
  if (!cumplioEsteAnio) años -= 1;
  return años >= 0 ? años : null;
}

/**
 * El backend guarda la traza de auditoria como "EMPLEADO:42:RESPONSABLE_AREA".
 * Mostrarla cruda no le dice nada a nadie.
 */
export function formatearAutor(traza) {
  if (!traza) return "—";
  const [tipo, id, rol] = String(traza).split(":");
  if (!id) return String(traza);
  const quien = tipo === "EMPLEADO" ? "Empleado" : "Titular";
  const rolLegible = rol ? ` · ${rol.replace(/_/g, " ").toLowerCase()}` : "";
  return `${quien} #${id}${rolLegible}`;
}

export function nombreCompleto(persona) {
  if (!persona) return "";
  return [persona.nombre, persona.apellido].filter(Boolean).join(" ").trim();
}

/** "Faltan 3 días" / "Vencido hace 2 días" — para plazos de documentacion. */
export function diasHasta(fechaIso) {
  if (!fechaIso) return null;
  const [anio, mes, dia] = String(fechaIso).split("-").map(Number);
  if (!anio) return null;
  const objetivo = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((objetivo - hoy) / 86400000);
}

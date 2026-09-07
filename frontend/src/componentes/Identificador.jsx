import { cn } from "@/lib/utils";
import { formatearCuit, formatearDni } from "@/lib/dominio/formato";

/**
 * DNI, CUIT/CUIL, número de expediente.
 *
 * Van en monoespaciada porque son códigos que la gente compara dígito por
 * dígito contra un papel que tiene en la mano. El mono los alinea en columna
 * y hace evidente si a uno le falta una cifra. No es un gesto estético.
 */
export function Identificador({ valor, tipo = "texto", className }) {
  if (valor === null || valor === undefined || valor === "") {
    return <span className="text-apagado">—</span>;
  }
  const texto =
    tipo === "cuit" ? formatearCuit(valor) : tipo === "dni" ? formatearDni(valor) : String(valor);

  return <span className={cn("identificador", className)}>{texto}</span>;
}

import { useCallback, useEffect, useState } from "react";
import { actualizarCiudadano, obtenerCiudadano } from "@/lib/api/endpoints/ciudadanos";
import { useRecurso } from "@/lib/useRecurso";
import { useSesion } from "@/lib/auth/SesionContext";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Cargando, ErrorEnPantalla } from "@/componentes/Estados";
import { Encabezado } from "@/componentes/Encabezado";
import { Button } from "@/componentes/ui/button";
import { Campo } from "@/componentes/ui/campo";
import { Card, CardCuerpo } from "@/componentes/ui/card";

/**
 * Los datos propios del vecino.
 *
 * `PUT /ciudadanos/{id}` acepta exactamente cinco campos y es parcial. El
 * estado no está entre ellos a propósito: se cambia sólo desde el backoffice y
 * con el permiso más alto del sistema.
 */
export function Perfil() {
  const { id } = useSesion();
  const persona = useRecurso(useCallback((s) => obtenerCiudadano(id, s), [id]));

  const [valores, setValores] = useState(null);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!persona.datos) return;
    const { nombre, apellido, fechaNacimiento, dni, cuil } = persona.datos;
    setValores({ nombre: nombre ?? "", apellido: apellido ?? "", fechaNacimiento: fechaNacimiento ?? "", dni: dni ?? "", cuil: cuil ?? "" });
  }, [persona.datos]);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
    setGuardado(false);
  }

  function validar() {
    const e = {};
    if (!valores.nombre.trim()) e.nombre = "Ingresá tu nombre.";
    if (!valores.apellido.trim()) e.apellido = "Ingresá tu apellido.";
    if (!valores.fechaNacimiento) e.fechaNacimiento = "Ingresá tu fecha de nacimiento.";
    else if (valores.fechaNacimiento >= new Date().toISOString().slice(0, 10)) {
      e.fechaNacimiento = "La fecha tiene que ser anterior a hoy.";
    }
    const dni = soloDigitos(valores.dni);
    if (!dni) e.dni = "Ingresá tu DNI.";
    else if (dni.length < 7 || dni.length > 9) e.dni = "El DNI tiene entre 7 y 9 dígitos.";
    const cuil = soloDigitos(valores.cuil);
    if (cuil && cuil.length !== 11) e.cuil = "El CUIL tiene 11 dígitos.";

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    setGuardado(false);
    if (!validar()) return;

    setGuardando(true);
    try {
      await actualizarCiudadano(id, valores);
      persona.recargar();
      setGuardado(true);
    } catch (error) {
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Encabezado
        seccion="Portal del vecino"
        titulo="Mis datos"
        descripcion="Así figurás en el registro municipal. Mantenerlos al día evita demoras en tus trámites."
        acciones={
          persona.datos && (
            <BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={persona.datos.estado} />
          )
        }
      />

      {persona.cargando && <Cargando />}
      {persona.error && <ErrorEnPantalla error={persona.error} alReintentar={persona.recargar} />}

      {valores && (
        <Card>
          <CardCuerpo>
            <form onSubmit={guardar} noValidate className="flex flex-col gap-u3">
              <div className="grid gap-u2 sm:grid-cols-2">
                <Campo
                  etiqueta="Nombre"
                  obligatorio
                  autoComplete="given-name"
                  value={valores.nombre}
                  onChange={(e) => cambiar("nombre", e.target.value)}
                  error={errores.nombre}
                />
                <Campo
                  etiqueta="Apellido"
                  obligatorio
                  autoComplete="family-name"
                  value={valores.apellido}
                  onChange={(e) => cambiar("apellido", e.target.value)}
                  error={errores.apellido}
                />
              </div>

              <div className="grid gap-u2 sm:grid-cols-3">
                <Campo
                  etiqueta="Fecha de nacimiento"
                  obligatorio
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={valores.fechaNacimiento}
                  onChange={(e) => cambiar("fechaNacimiento", e.target.value)}
                  error={errores.fechaNacimiento}
                />
                <Campo
                  etiqueta="DNI"
                  obligatorio
                  inputMode="numeric"
                  ayuda="Sin puntos"
                  value={valores.dni}
                  onChange={(e) => cambiar("dni", e.target.value)}
                  error={errores.dni}
                />
                <Campo
                  etiqueta="CUIL"
                  inputMode="numeric"
                  ayuda="Once dígitos"
                  value={valores.cuil}
                  onChange={(e) => cambiar("cuil", e.target.value)}
                  error={errores.cuil}
                />
              </div>

              {errorGeneral && (
                <p
                  role="alert"
                  className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
                >
                  {errorGeneral.status === 409
                    ? "Ya hay otra persona registrada con ese DNI o CUIL."
                    : mensajeAmable(errorGeneral)}
                </p>
              )}

              <div className="flex items-center gap-u2">
                <Button type="submit" disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </Button>
                {guardado && (
                  <p
                    role="status"
                    className="aparece text-[length:var(--texto-dato)] font-medium text-vigente"
                  >
                    Datos actualizados.
                  </p>
                )}
              </div>
            </form>
          </CardCuerpo>
        </Card>
      )}
    </>
  );
}

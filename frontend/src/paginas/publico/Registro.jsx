import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { registrarYEntrar } from "@/lib/api/endpoints/auth";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { Button } from "@/componentes/ui/button";
import { Campo } from "@/componentes/ui/campo";

/**
 * Alta de persona física o jurídica.
 *
 * El backend tiene un solo endpoint con un solo cuerpo, donde `tipo` decide
 * qué bloque de campos se exige. La pantalla hace lo mismo: se elige primero
 * qué se está registrando y recién ahí aparecen los campos que corresponden.
 * Mostrar los once campos juntos obligaría a la persona a descartar la mitad.
 *
 * `POST /auth/register` no devuelve tokens, así que después del alta se hace
 * el login automáticamente: se completa un formulario y se queda adentro.
 */

const CIUDADANO = "CIUDADANO";
const JURIDICA = "JURIDICA";

const VACIO = {
  tipo: CIUDADANO,
  cuit: "",
  password: "",
  dni: "",
  nombre: "",
  apellido: "",
  fechaNacimiento: "",
  razonSocial: "",
  nombreFantasia: "",
};

export function Registro() {
  const navegar = useNavigate();
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const esPersona = valores.tipo === CIUDADANO;

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validar() {
    const e = {};
    const cuit = soloDigitos(valores.cuit);

    if (!cuit) e.cuit = esPersona ? "Ingresá tu CUIL." : "Ingresá el CUIT.";
    else if (cuit.length !== 11) e.cuit = "Tiene que tener 11 dígitos.";

    if (!valores.password) e.password = "Elegí una contraseña.";
    else if (valores.password.length < 8) e.password = "Tiene que tener al menos 8 caracteres.";

    if (esPersona) {
      const dni = soloDigitos(valores.dni);
      if (!dni) e.dni = "Ingresá tu DNI.";
      else if (dni.length < 7 || dni.length > 9) e.dni = "El DNI tiene entre 7 y 9 dígitos.";
      if (!valores.nombre.trim()) e.nombre = "Ingresá tu nombre.";
      if (!valores.apellido.trim()) e.apellido = "Ingresá tu apellido.";
      if (!valores.fechaNacimiento) e.fechaNacimiento = "Ingresá tu fecha de nacimiento.";
      else if (valores.fechaNacimiento >= new Date().toISOString().slice(0, 10)) {
        e.fechaNacimiento = "La fecha tiene que ser anterior a hoy.";
      }
    } else {
      if (!valores.razonSocial.trim()) e.razonSocial = "Ingresá la razón social.";
      if (!valores.nombreFantasia.trim()) e.nombreFantasia = "Ingresá el nombre de fantasía.";
    }

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      const { sesion } = await registrarYEntrar(valores);
      navegar(sesion.subType === "EMPLEADO" ? "/admin" : "/portal", { replace: true });
    } catch (error) {
      // El backend devuelve el detalle campo por campo en los 400 de validación.
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <h1 className="mb-1">Crear cuenta</h1>
      <p className="mb-u3 text-apagado">
        Registrarte en el municipio es el primer paso: con esta cuenta vas a poder hacer
        trámites en todas las áreas.
      </p>

      <fieldset className="mb-u3">
        <legend className="mb-1.5 text-sm font-medium text-tinta">¿Qué vas a registrar?</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {[
            [CIUDADANO, "Una persona", "Con DNI y CUIL"],
            [JURIDICA, "Una organización", "Empresa, comercio o asociación"],
          ].map(([valor, titulo, detalle]) => (
            <label
              key={valor}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded border p-3 transition-colors duration-150",
                valores.tipo === valor
                  ? "border-expediente bg-expediente-suave"
                  : "border-borde-fuerte bg-superficie hover:bg-papel",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tipo"
                  value={valor}
                  checked={valores.tipo === valor}
                  onChange={() => {
                    setValores((v) => ({ ...v, tipo: valor }));
                    setErrores({});
                  }}
                  className="size-4 accent-[color:var(--expediente)]"
                />
                <span className="font-medium text-tinta">{titulo}</span>
              </span>
              <span className="pl-6 text-sm text-apagado">{detalle}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
        {esPersona ? (
          <>
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
            <div className="grid gap-u2 sm:grid-cols-2">
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
                etiqueta="Fecha de nacimiento"
                obligatorio
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={valores.fechaNacimiento}
                onChange={(e) => cambiar("fechaNacimiento", e.target.value)}
                error={errores.fechaNacimiento}
              />
            </div>
          </>
        ) : (
          <div className="grid gap-u2 sm:grid-cols-2">
            <Campo
              etiqueta="Razón social"
              obligatorio
              ayuda="Como figura en el estatuto"
              value={valores.razonSocial}
              onChange={(e) => cambiar("razonSocial", e.target.value)}
              error={errores.razonSocial}
            />
            <Campo
              etiqueta="Nombre de fantasía"
              obligatorio
              ayuda="Con el que se conoce al comercio"
              value={valores.nombreFantasia}
              onChange={(e) => cambiar("nombreFantasia", e.target.value)}
              error={errores.nombreFantasia}
            />
          </div>
        )}

        <Campo
          etiqueta={esPersona ? "CUIL" : "CUIT"}
          obligatorio
          inputMode="numeric"
          ayuda="Once dígitos, con o sin guiones"
          value={valores.cuit}
          onChange={(e) => cambiar("cuit", e.target.value)}
          error={errores.cuit}
        />

        <Campo
          etiqueta="Contraseña"
          obligatorio
          type="password"
          autoComplete="new-password"
          ayuda="Al menos 8 caracteres"
          value={valores.password}
          onChange={(e) => cambiar("password", e.target.value)}
          error={errores.password}
        />

        {errorGeneral && (
          <p
            role="alert"
            className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
          >
            {errorGeneral.status === 409
              ? "Ya hay una cuenta registrada con ese CUIT o DNI. Probá ingresar."
              : mensajeAmable(errorGeneral)}
          </p>
        )}

        <p className="text-sm text-apagado">
          El domicilio se carga después, desde tu perfil.
        </p>

        <Button type="submit" disabled={enviando} className="mt-u1 w-full">
          {enviando ? "Creando la cuenta…" : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-u3 text-[length:var(--texto-dato)] text-apagado">
        ¿Ya tenés cuenta?{" "}
        <Link to="/ingresar" className="font-medium text-expediente hover:underline">
          Ingresá
        </Link>
        .
      </p>
    </div>
  );
}

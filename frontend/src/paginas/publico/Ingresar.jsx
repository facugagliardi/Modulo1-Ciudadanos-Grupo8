import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ingresar, ingresarEmpleado } from "@/lib/api/endpoints/auth";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { Button } from "@/componentes/ui/button";
import { Campo } from "@/componentes/ui/campo";

/**
 * Un solo ingreso para dos públicos.
 *
 * El backend tiene dos endpoints distintos con campos distintos: el vecino se
 * identifica con CUIT/CUIL y el empleado con su correo. En vez de dos
 * pantallas separadas —que obligan a adivinar cuál te toca— hay un solo lugar
 * y un interruptor. Es la misma decisión que hace el mostrador de una
 * municipalidad: una puerta, y adentro te derivan.
 */

const VECINO = "vecino";
const EMPLEADO = "empleado";

export function Ingresar() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const destino = ubicacion.state?.destino;

  const [quien, setQuien] = useState(VECINO);
  const [valores, setValores] = useState({ cuit: "", mail: "", password: "" });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const esVecino = quien === VECINO;

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validar() {
    const e = {};
    if (esVecino) {
      const digitos = soloDigitos(valores.cuit);
      if (!digitos) e.cuit = "Ingresá tu CUIT o CUIL.";
      else if (digitos.length !== 11) e.cuit = "El CUIT/CUIL tiene 11 dígitos.";
    } else {
      if (!valores.mail.trim()) e.mail = "Ingresá tu correo.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.mail)) e.mail = "Revisá el correo.";
    }
    if (!valores.password) e.password = "Ingresá tu contraseña.";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      const sesion = esVecino
        ? await ingresar({ cuit: valores.cuit, password: valores.password })
        : await ingresarEmpleado({ mail: valores.mail, password: valores.password });

      const casa = sesion.subType === "EMPLEADO" ? "/admin" : "/portal";
      navegar(destino && destino !== "/" ? destino : casa, { replace: true });
    } catch (error) {
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="mb-1">Ingresar</h1>
      <p className="mb-u3 text-apagado">
        Accedé a tus trámites, domicilios y expedientes municipales.
      </p>

      {/* Interruptor entre los dos endpoints de login del backend. */}
      <div
        role="radiogroup"
        aria-label="Tipo de usuario"
        className="mb-u3 grid grid-cols-2 gap-1 rounded border border-borde bg-superficie p-1"
      >
        {[
          [VECINO, "Soy vecino"],
          [EMPLEADO, "Soy empleado"],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={quien === valor}
            onClick={() => {
              setQuien(valor);
              setErrores({});
              setErrorGeneral(null);
            }}
            className={cn(
              "rounded px-3 py-2 text-[length:var(--texto-dato)] font-medium transition-colors duration-150",
              quien === valor
                ? "bg-expediente text-white"
                : "text-apagado hover:bg-papel hover:text-tinta",
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} noValidate className="flex flex-col gap-u2">
        {esVecino ? (
          <Campo
            etiqueta="CUIT o CUIL"
            obligatorio
            ayuda="Once dígitos. Podés escribirlo con o sin guiones."
            inputMode="numeric"
            autoComplete="username"
            value={valores.cuit}
            onChange={(e) => cambiar("cuit", e.target.value)}
            error={errores.cuit}
          />
        ) : (
          <Campo
            etiqueta="Correo institucional"
            obligatorio
            type="email"
            autoComplete="username"
            placeholder="nombre@municipio.gob.ar"
            value={valores.mail}
            onChange={(e) => cambiar("mail", e.target.value)}
            error={errores.mail}
          />
        )}

        <Campo
          etiqueta="Contraseña"
          obligatorio
          type="password"
          autoComplete="current-password"
          value={valores.password}
          onChange={(e) => cambiar("password", e.target.value)}
          error={errores.password}
        />

        {errorGeneral && (
          <p
            role="alert"
            className="rounded border border-sello bg-sello-suave px-3 py-2 text-[length:var(--texto-dato)] font-medium text-sello"
          >
            {mensajeAmable(errorGeneral)}
          </p>
        )}

        <Button type="submit" disabled={enviando} className="mt-u1 w-full">
          {enviando ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>

      {esVecino && (
        <p className="mt-u3 text-[length:var(--texto-dato)] text-apagado">
          ¿Todavía no te registraste?{" "}
          <Link to="/registro" className="font-medium text-expediente hover:underline">
            Creá tu cuenta
          </Link>
          .
        </p>
      )}
    </div>
  );
}

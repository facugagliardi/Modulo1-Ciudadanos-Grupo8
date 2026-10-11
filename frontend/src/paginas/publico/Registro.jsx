import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, FileText, Mail, ShieldAlert, Upload } from "lucide-react";
import { registrarYEntrar } from "@/lib/api/endpoints/auth";
import { subirDocumento } from "@/lib/api/endpoints/documentacion";
import { crearContacto } from "@/lib/api/endpoints/contactos";
import { mensajeAmable } from "@/lib/api/cliente";
import { soloDigitos } from "@/lib/dominio/formato";
import { Button } from "@/componentes/ui/button";
import { Campo } from "@/componentes/ui/campo";
import { CampoFecha, hoyISO } from "@/componentes/ui/fecha";

/**
 * Alta de ciudadano físico con onboarding obligatorio:
 * 1. Datos personales (incluye nacionalidad).
 * 2. Carga obligatoria de foto/archivo de documento (DNI).
 * 3. Carga obligatoria de correo electrónico de contacto.
 * 4. Ingreso al portal.
 */

const VACIO = {
  cuit: "",
  password: "",
  dni: "",
  nombre: "",
  apellido: "",
  fechaNacimiento: "",
  nacionalidad: "Argentina",
};

export function Registro() {
  const navegar = useNavigate();
  const [paso, setPaso] = useState(1);
  const [ciudadanoId, setCiudadanoId] = useState(null);

  // Paso 1: Datos
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Paso 2: Documento
  const [archivoDoc, setArchivoDoc] = useState(null);
  const [errorDoc, setErrorDoc] = useState(null);
  const [subiendoDoc, setSubiendoDoc] = useState(false);

  // Paso 3: Contacto
  const [email, setEmail] = useState("");
  const [errorEmail, setErrorEmail] = useState(null);
  const [guardandoEmail, setGuardandoEmail] = useState(false);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validarPaso1() {
    const e = {};
    const cuit = soloDigitos(valores.cuit);

    if (!cuit) e.cuit = "Ingresá tu CUIL.";
    else if (cuit.length !== 11) e.cuit = "Tiene que tener 11 dígitos.";

    if (!valores.password) e.password = "Elegí una contraseña.";
    else if (valores.password.length < 8) e.password = "Tiene que tener al menos 8 caracteres.";

    const dni = soloDigitos(valores.dni);
    if (!dni) e.dni = "Ingresá tu DNI.";
    else if (dni.length < 7 || dni.length > 9) e.dni = "El DNI tiene entre 7 y 9 dígitos.";

    if (!valores.nombre.trim()) e.nombre = "Ingresá tu nombre.";
    if (!valores.apellido.trim()) e.apellido = "Ingresá tu apellido.";
    if (!valores.nacionalidad.trim()) e.nacionalidad = "Ingresá tu nacionalidad.";
    if (!valores.fechaNacimiento) e.fechaNacimiento = "Ingresá tu fecha de nacimiento.";
    else if (valores.fechaNacimiento >= new Date().toISOString().slice(0, 10)) {
      e.fechaNacimiento = "La fecha tiene que ser anterior a hoy.";
    }

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviarPaso1(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validarPaso1()) return;

    setEnviando(true);
    try {
      const { sesion, ciudadano } = await registrarYEntrar(valores);
      const idRegistrado = ciudadano?.id ?? sesion?.id;
      setCiudadanoId(idRegistrado);
      setPaso(2);
    } catch (error) {
      if (error?.tieneErroresDeCampo) setErrores(error.errores);
      setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarPaso2(evento) {
    evento.preventDefault();
    setErrorDoc(null);
    if (!archivoDoc) {
      setErrorDoc("Seleccioná la foto o archivo de tu DNI.");
      return;
    }

    setSubiendoDoc(true);
    try {
      await subirDocumento(ciudadanoId, {
        archivo: archivoDoc,
        tipoDocumento: "DNI",
      });
      setPaso(3);
    } catch (error) {
      setErrorDoc(mensajeAmable(error));
    } finally {
      setSubiendoDoc(false);
    }
  }

  async function enviarPaso3(evento) {
    evento.preventDefault();
    setErrorEmail(null);
    const mailLimpio = email.trim();
    if (!mailLimpio) {
      setErrorEmail("Ingresá tu correo electrónico.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailLimpio)) {
      setErrorEmail("Ingresá un correo electrónico válido.");
      return;
    }

    setGuardandoEmail(true);
    try {
      await crearContacto(ciudadanoId, {
        tipo: "EMAIL",
        valor: mailLimpio,
      });
      navegar("/portal", { replace: true });
    } catch (error) {
      setErrorEmail(mensajeAmable(error));
    } finally {
      setGuardandoEmail(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      {/* Indicador de pasos */}
      <div className="mb-u3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-apagado border-b border-borde pb-2">
        <span className={paso >= 1 ? "text-expediente font-bold" : ""}>
          1. Datos
        </span>
        <span className="text-borde">→</span>
        <span className={paso >= 2 ? "text-expediente font-bold" : ""}>
          2. Documento
        </span>
        <span className="text-borde">→</span>
        <span className={paso >= 3 ? "text-expediente font-bold" : ""}>
          3. Contacto
        </span>
      </div>

      {paso === 1 && (
        <>
          <h1 className="mb-1">Crear cuenta</h1>
          <p className="mb-u3 text-apagado">
            Registrarte en el municipio es el primer paso: con esta cuenta vas a poder hacer
            trámites en todas las áreas.
          </p>

          <form onSubmit={enviarPaso1} noValidate className="flex flex-col gap-u2">
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
              <CampoFecha
                etiqueta="Fecha de nacimiento"
                obligatorio
                max={hoyISO()}
                value={valores.fechaNacimiento}
                onChange={(e) => cambiar("fechaNacimiento", e.target.value)}
                error={errores.fechaNacimiento}
              />
            </div>

            <div className="grid gap-u2 sm:grid-cols-2">
              <Campo
                etiqueta="Nacionalidad"
                obligatorio
                ayuda="País de origen"
                value={valores.nacionalidad}
                onChange={(e) => cambiar("nacionalidad", e.target.value)}
                error={errores.nacionalidad}
              />
              <Campo
                etiqueta="CUIL"
                obligatorio
                inputMode="numeric"
                ayuda="Once dígitos, con o sin guiones"
                value={valores.cuit}
                onChange={(e) => cambiar("cuit", e.target.value)}
                error={errores.cuit}
              />
            </div>

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
              {enviando ? "Creando la cuenta…" : "Continuar a documentación"}
            </Button>
          </form>

          <p className="mt-u3 text-[length:var(--texto-dato)] text-apagado">
            ¿Ya tenés cuenta?{" "}
            <Link to="/ingresar" className="font-medium text-expediente hover:underline">
              Ingresá
            </Link>
            .
          </p>
        </>
      )}

      {paso === 2 && (
        <div className="rounded border border-borde bg-papel p-5 flex flex-col gap-u3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-expediente-suave p-2 text-expediente">
              <FileText className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Subí tu documento de identidad</h1>
              <p className="text-sm text-apagado">
                Es obligatorio adjuntar una foto o copia digital de tu DNI para verificar tu cuenta.
              </p>
            </div>
          </div>

          <form onSubmit={enviarPaso2} noValidate className="flex flex-col gap-u3">
            <div className="rounded border-2 border-dashed border-borde p-6 text-center flex flex-col items-center justify-center gap-2 bg-fondo">
              <Upload className="size-8 text-apagado" aria-hidden="true" />
              <label
                htmlFor="archivo-dni"
                className="cursor-pointer font-medium text-expediente hover:underline text-sm"
              >
                {archivoDoc ? "Cambiar archivo seleccionado" : "Elegir foto o archivo de tu DNI"}
              </label>
              <input
                id="archivo-dni"
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  setArchivoDoc(e.target.files?.[0] ?? null);
                  setErrorDoc(null);
                }}
              />
              <span className="text-xs text-apagado">Formatos admitidos: JPG, PNG o PDF</span>
              {archivoDoc && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-papel px-3 py-1 text-sm font-medium border border-borde">
                  <CheckCircle2 className="size-4 text-exito" aria-hidden="true" />
                  <span>{archivoDoc.name}</span>
                </div>
              )}
            </div>

            {errorDoc && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-sm font-medium text-sello"
              >
                {errorDoc}
              </p>
            )}

            <Button type="submit" disabled={subiendoDoc} className="w-full">
              {subiendoDoc ? "Enviando documento…" : "Enviar documento y continuar"}
            </Button>
          </form>
        </div>
      )}

      {paso === 3 && (
        <div className="rounded border border-borde bg-papel p-5 flex flex-col gap-u3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-expediente-suave p-2 text-expediente">
              <Mail className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Datos de contacto</h1>
              <p className="text-sm text-apagado">
                Ingresá tu correo electrónico para que podamos enviarte notificaciones y avisos oficiales.
              </p>
            </div>
          </div>

          <form onSubmit={enviarPaso3} noValidate className="flex flex-col gap-u3">
            <Campo
              etiqueta="Correo electrónico"
              obligatorio
              type="email"
              inputMode="email"
              autoComplete="email"
              ayuda="ejemplo@correo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorEmail(null);
              }}
              error={errorEmail}
            />

            {errorEmail && (
              <p
                role="alert"
                className="rounded border border-sello bg-sello-suave px-3 py-2 text-sm font-medium text-sello"
              >
                {errorEmail}
              </p>
            )}

            <Button type="submit" disabled={guardandoEmail} className="w-full">
              {guardandoEmail ? "Guardando…" : "Guardar correo y entrar al sistema"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

import { useCallback } from "react";
import { UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { listarCiudadanos } from "@/lib/api/endpoints/ciudadanos";
import { useRecurso } from "@/lib/useRecurso";
import { edad, formatearFecha, nombreCompleto } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { PERMISOS } from "@/lib/auth/permisos";
import { usePermiso } from "@/lib/auth/SesionContext";
import { Tabla } from "@/componentes/Tabla";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Identificador } from "@/componentes/Identificador";
import { Button } from "@/componentes/ui/button";
import { Encabezado } from "@/componentes/Encabezado";

/**
 * El padrón municipal.
 *
 * `GET /ciudadanos` devuelve el listado COMPLETO, sin filtros ni paginación:
 * el backend no acepta query params. Todo el trabajo de buscar, filtrar,
 * ordenar y paginar lo hace <Tabla> del lado del cliente.
 *
 * RF-07 pide buscar por DNI, nombre, domicilio, teléfono o correo. El listado
 * solo trae los datos personales, así que acá se puede buscar por nombre,
 * apellido, DNI y CUIL; domicilio y contacto están en el legajo de cada
 * persona. Está anotado en contexto.md como pedido al backend.
 */

const ESTADOS = [
  { valor: "ACTIVO", etiqueta: "Activo" },
  { valor: "INACTIVO", etiqueta: "Inactivo" },
  { valor: "BLOQUEADO", etiqueta: "Bloqueado" },
  { valor: "FALLECIDO", etiqueta: "Fallecido" },
];

export function Padron() {
  const puedeEditar = usePermiso(PERMISOS.EDITAR_TERCEROS);

  const cargar = useCallback((senal) => listarCiudadanos(senal), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  const columnas = [
    {
      clave: "apellido",
      titulo: "Vecino",
      valorOrden: (f) => `${f.apellido ?? ""} ${f.nombre ?? ""}`,
      render: (f) => nombreCompleto(f) || "Sin nombre",
    },
    {
      clave: "dni",
      titulo: "DNI",
      ancho: "w-32",
      render: (f) => <Identificador valor={f.dni} tipo="dni" />,
    },
    {
      clave: "cuil",
      titulo: "CUIL",
      ancho: "w-40",
      render: (f) => <Identificador valor={f.cuil} tipo="cuit" />,
    },
    {
      clave: "fechaNacimiento",
      titulo: "Nacimiento",
      ancho: "w-44",
      render: (f) => {
        if (!f.fechaNacimiento) return <span className="text-apagado">—</span>;
        const años = edad(f.fechaNacimiento);
        return (
          <span className="tabular">
            {formatearFecha(f.fechaNacimiento)}
            {años !== null && <span className="ml-1.5 text-apagado">({años} años)</span>}
          </span>
        );
      },
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-36",
      render: (f) => <BadgeEstado entidad={ENTIDADES.CIUDADANO} estado={f.estado} />,
    },
  ];

  return (
    <>
      <Encabezado
        seccion="Registro civil"
        titulo="Padrón de vecinos"
        descripcion="Todas las personas físicas registradas en el municipio."
        acciones={
          puedeEditar && (
            <Button asChild>
              <Link to="/admin/padron/nuevo">
                <UserPlus aria-hidden="true" />
                Registrar vecino
              </Link>
            </Button>
          )
        }
      />

      <Tabla
        columnas={columnas}
        filas={datos}
        claveFila={(f) => f.id}
        cargando={cargando}
        error={error}
        alReintentar={recargar}
        buscarEn={["nombre", "apellido", "dni", "cuil"]}
        etiquetaBusqueda="Buscar por nombre, apellido, DNI o CUIL"
        filtros={[{ clave: "estado", etiqueta: "Estado", opciones: ESTADOS }]}
        enlaceFila={(f) => `/admin/padron/${f.id}`}
        vacio={{
          titulo: "El padrón está vacío",
          descripcion: "Todavía no hay vecinos registrados en el sistema.",
        }}
      />
    </>
  );
}

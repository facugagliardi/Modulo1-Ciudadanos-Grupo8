import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { listarOrganizaciones } from "@/lib/api/endpoints/organizaciones";
import { useRecurso } from "@/lib/useRecurso";
import { formatearFecha } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { etiquetaDe, TIPOS_ORGANIZACION } from "@/lib/dominio/listasBlancas";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Encabezado } from "@/componentes/Encabezado";
import { Identificador } from "@/componentes/Identificador";
import { Tabla } from "@/componentes/Tabla";
import { Button } from "@/componentes/ui/button";

/**
 * Todas las organizaciones del municipio.
 *
 * Como el padrón: el backend devuelve el listado completo y filtrar es del
 * front. El alta no exige permiso — cualquier usuario autenticado puede
 * registrar una organización.
 */
const ESTADOS = [
  { valor: "ACTIVA", etiqueta: "Activa" },
  { valor: "INACTIVA", etiqueta: "Inactiva" },
  { valor: "BLOQUEADA", etiqueta: "Bloqueada" },
];

export function Organizaciones() {
  const { datos, cargando, error, recargar } = useRecurso(
    useCallback((s) => listarOrganizaciones(s), []),
  );

  const columnas = [
    { clave: "razonSocial", titulo: "Razón social" },
    {
      clave: "nombreFantasia",
      titulo: "Nombre de fantasía",
      render: (o) => o.nombreFantasia || <span className="text-apagado">—</span>,
    },
    {
      clave: "cuit",
      titulo: "CUIT",
      ancho: "w-40",
      render: (o) => <Identificador valor={o.cuit} tipo="cuit" />,
    },
    {
      clave: "tipo",
      titulo: "Tipo",
      ancho: "w-36",
      render: (o) => etiquetaDe(TIPOS_ORGANIZACION, o.tipo),
    },
    {
      clave: "creadoEn",
      titulo: "Alta",
      ancho: "w-32",
      render: (o) => <span className="tabular">{formatearFecha(o.creadoEn)}</span>,
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-32",
      render: (o) => <BadgeEstado entidad={ENTIDADES.ORGANIZACION} estado={o.estado} />,
    },
  ];

  return (
    <>
      <Encabezado
        seccion="Gestión interna"
        titulo="Organizaciones"
        descripcion="Empresas, comercios, asociaciones e instituciones registradas en el municipio."
        acciones={
          <Button asChild>
            <Link to="/admin/organizaciones/nueva">
              <Building2 aria-hidden="true" />
              Registrar organización
            </Link>
          </Button>
        }
      />

      <Tabla
        columnas={columnas}
        filas={datos}
        claveFila={(o) => o.organizacionId}
        cargando={cargando}
        error={error}
        alReintentar={recargar}
        buscarEn={["razonSocial", "nombreFantasia", "cuit"]}
        etiquetaBusqueda="Buscar por razón social, nombre de fantasía o CUIT"
        filtros={[
          { clave: "estado", etiqueta: "Estado", opciones: ESTADOS },
          { clave: "tipo", etiqueta: "Tipo", opciones: TIPOS_ORGANIZACION },
        ]}
        enlaceFila={(o) => `/admin/organizaciones/${o.organizacionId}`}
        vacio={{
          titulo: "No hay organizaciones registradas",
          descripcion: "Cuando se registre la primera, va a aparecer acá.",
        }}
      />
    </>
  );
}

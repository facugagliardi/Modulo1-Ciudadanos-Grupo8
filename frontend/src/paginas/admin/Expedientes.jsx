import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { FilePlus } from "lucide-react";
import { listarExpedientes } from "@/lib/api/endpoints/expedientes";
import { useRecurso } from "@/lib/useRecurso";
import { usePermiso } from "@/lib/auth/SesionContext";
import { PERMISOS } from "@/lib/auth/permisos";
import { formatearFecha } from "@/lib/dominio/formato";
import { ENTIDADES } from "@/lib/dominio/estados";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { Encabezado } from "@/componentes/Encabezado";
import { Identificador } from "@/componentes/Identificador";
import { Tabla } from "@/componentes/Tabla";
import { Button } from "@/componentes/ui/button";

/**
 * Todos los expedientes del municipio.
 *
 * Como en el padrón, el backend devuelve el listado completo y el filtrado es
 * nuestro. El filtro de área se arma con las áreas que realmente aparecen en
 * los datos: `areaIniciadora` es texto libre en el backend, así que no hay una
 * lista fija que copiar.
 */
const ESTADOS = [
  { valor: "INICIADO", etiqueta: "Iniciado" },
  { valor: "EN_TRAMITE", etiqueta: "En trámite" },
  { valor: "RESUELTO", etiqueta: "Resuelto" },
  { valor: "ARCHIVADO", etiqueta: "Archivado" },
];

export function Expedientes() {
  const puedeGestionar = usePermiso(PERMISOS.GESTIONAR_EXPEDIENTES);
  const { datos, cargando, error, recargar } = useRecurso(useCallback((s) => listarExpedientes(s), []));

  const areas = useMemo(() => {
    const vistas = [...new Set((datos ?? []).map((e) => e.areaIniciadora).filter(Boolean))];
    return vistas.sort((a, b) => a.localeCompare(b, "es")).map((a) => ({ valor: a, etiqueta: a }));
  }, [datos]);

  const columnas = [
    {
      clave: "numero",
      titulo: "Número",
      ancho: "w-44",
      render: (e) => <Identificador valor={e.numero} />,
    },
    { clave: "caratula", titulo: "Carátula" },
    { clave: "areaIniciadora", titulo: "Área iniciadora", ancho: "w-48" },
    {
      clave: "fechaInicio",
      titulo: "Inicio",
      ancho: "w-32",
      render: (e) => <span className="tabular">{formatearFecha(e.fechaInicio)}</span>,
    },
    {
      clave: "actuacionesCount",
      titulo: "Actuaciones",
      ancho: "w-28",
      alineacion: "derecha",
      render: (e) => (
        <span className={e.actuacionesCount ? "tabular" : "tabular text-apagado"}>
          {e.actuacionesCount ?? 0}
        </span>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-36",
      render: (e) => <BadgeEstado entidad={ENTIDADES.EXPEDIENTE} estado={e.estado} />,
    },
  ];

  const estancados = (datos ?? []).filter(
    (e) => !e.actuacionesCount && e.estado !== "ARCHIVADO",
  ).length;

  return (
    <>
      <Encabezado
        seccion="Gestión interna"
        titulo="Expedientes"
        descripcion="El registro formal de lo que hace cada área. Su numeración y su historia son responsabilidad de este módulo."
        acciones={
          puedeGestionar && (
            <Button asChild>
              <Link to="/admin/expedientes/nuevo">
                <FilePlus aria-hidden="true" />
                Iniciar expediente
              </Link>
            </Button>
          )
        }
      />

      <Tabla
        columnas={columnas}
        filas={datos}
        claveFila={(e) => e.expedienteId}
        cargando={cargando}
        error={error}
        alReintentar={recargar}
        buscarEn={["numero", "caratula", "areaIniciadora"]}
        etiquetaBusqueda="Buscar por número, carátula o área"
        filtros={[
          { clave: "estado", etiqueta: "Estado", opciones: ESTADOS },
          { clave: "areaIniciadora", etiqueta: "Área", opciones: areas },
        ]}
        enlaceFila={(e) => `/admin/expedientes/${e.expedienteId}`}
        resumen={
          estancados > 0
            ? `${estancados} sin ninguna actuación`
            : undefined
        }
        vacio={{
          titulo: "No hay expedientes",
          descripcion: "Cuando un área inicie el primero, va a aparecer acá.",
        }}
      />
    </>
  );
}

package ar.edu.uade.ciudadanos.security;

/**
 * Lo que se puede hacer, independiente de quien lo haga.
 *
 * <p>Los servicios preguntan por permisos, nunca por roles: asi cambiar quien
 * puede que es tocar {@link Rol} y nada mas. Ojo: estos permisos gobiernan las
 * operaciones sobre datos AJENOS. Operar sobre los datos propios no necesita
 * ninguno (ver {@link AutorizacionService}).
 */
public enum Permiso {

    /** Ver el legajo de otra persona u organizacion. */
    LEER_TERCEROS,

    /** Descargar el padron completo (GET /ciudadanos, GET /solicitudes-documentacion). */
    LISTAR_PADRON,

    /** Modificar datos de otro: nombre, domicilios, contactos, relaciones, documentos. */
    EDITAR_TERCEROS,

    /** RF-05, RF-08: bloquear, dar de baja o marcar fallecido a un titular. */
    CAMBIAR_ESTADO_TITULAR,

    /** RF-25, RF-26: aprobar o rechazar un documento cargado. */
    VALIDAR_DOCUMENTACION,

    /** RF-27, RF-28: pedir documentacion faltante y darla por vencida. */
    SOLICITAR_DOCUMENTACION,

    /** RF-30, RF-33: iniciar expedientes y registrar actuaciones. */
    GESTIONAR_EXPEDIENTES,

    /** RF-32: mover el expediente entre estados. */
    CAMBIAR_ESTADO_EXPEDIENTE,

    /** RF-20, RF-21: otorgar y revocar poderes sobre una organizacion ajena. */
    GESTIONAR_REPRESENTACIONES,

    /** Endpoints marcados Svc: identidad, estado, domicilio principal, vigencia. */
    CONSULTA_INTERMODULO
}

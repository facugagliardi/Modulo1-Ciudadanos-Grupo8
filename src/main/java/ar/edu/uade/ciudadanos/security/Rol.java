package ar.edu.uade.ciudadanos.security;

import ar.edu.uade.ciudadanos.empleado.entity.RolEmpleado;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;

/**
 * Roles del sistema y que permisos trae cada uno.
 *
 * <p>Es la unica fuente de verdad: los servicios preguntan por {@link Permiso},
 * las anotaciones delegan en {@link AutorizacionService}, y nadie mas enumera
 * roles a mano.
 *
 * <p>Los cuatro roles de empleado son una escalera: mesa de entradas carga,
 * administrativo ademas resuelve, responsable de area ademas decide. AUDITOR
 * queda fuera de la escalera a proposito: ve todo y no escribe nada.
 */
public enum Rol {

    /**
     * Ciudadanos y personas juridicas comparten rol: los dos son titulares que
     * operan sobre lo propio. Lo que los diferencia es el tipo de persona
     * ({@link TipoSujeto}), no lo que tienen permitido hacer.
     */
    PERSONA(Set.of()),

    /** Recepcion: carga datos de terceros e inicia expedientes. No decide. */
    MESA_ENTRADAS(Set.of(
            Permiso.LEER_TERCEROS,
            Permiso.LISTAR_PADRON,
            Permiso.EDITAR_TERCEROS,
            Permiso.SOLICITAR_DOCUMENTACION,
            Permiso.GESTIONAR_EXPEDIENTES,
            Permiso.CONSULTA_INTERMODULO)),

    /** Gestion: ademas valida documentacion y mueve estados. */
    ADMINISTRATIVO(Set.of(
            Permiso.LEER_TERCEROS,
            Permiso.LISTAR_PADRON,
            Permiso.EDITAR_TERCEROS,
            Permiso.SOLICITAR_DOCUMENTACION,
            Permiso.GESTIONAR_EXPEDIENTES,
            Permiso.CONSULTA_INTERMODULO,
            Permiso.VALIDAR_DOCUMENTACION,
            Permiso.CAMBIAR_ESTADO_EXPEDIENTE,
            Permiso.GESTIONAR_REPRESENTACIONES)),

    /** Supervision: ademas bloquea o da de baja titulares. */
    RESPONSABLE_AREA(Set.of(
            Permiso.LEER_TERCEROS,
            Permiso.LISTAR_PADRON,
            Permiso.EDITAR_TERCEROS,
            Permiso.SOLICITAR_DOCUMENTACION,
            Permiso.GESTIONAR_EXPEDIENTES,
            Permiso.CONSULTA_INTERMODULO,
            Permiso.VALIDAR_DOCUMENTACION,
            Permiso.CAMBIAR_ESTADO_EXPEDIENTE,
            Permiso.GESTIONAR_REPRESENTACIONES,
            Permiso.CAMBIAR_ESTADO_TITULAR)),

    /** Control: lectura total, escritura cero. Ni siquiera sobre datos ajenos. */
    AUDITOR(Set.of(
            Permiso.LEER_TERCEROS,
            Permiso.LISTAR_PADRON,
            Permiso.CONSULTA_INTERMODULO)),

    /**
     * Otro modulo llamando a M1. Solo las consultas acotadas del bloque Svc:
     * para eso existen los endpoints /identidad y /estado, en vez de dejar que
     * un modulo se traiga el legajo entero.
     */
    SERVICIO(Set.of(Permiso.CONSULTA_INTERMODULO));

    private final Set<Permiso> permisos;

    Rol(Set<Permiso> permisos) {
        this.permisos = permisos;
    }

    public Set<Permiso> permisos() {
        return permisos;
    }

    public boolean tiene(Permiso permiso) {
        return permisos.contains(permiso);
    }

    /** Traduce el rol que guarda la base para un empleado. */
    public static Rol deEmpleado(RolEmpleado rolEmpleado) {
        return Rol.valueOf(rolEmpleado.name());
    }

    /**
     * Resuelve el rol que viene en el claim del token.
     *
     * <p>Vacio si el nombre no existe: un token con un rol desconocido no
     * autoriza nada, en vez de romper con una excepcion.
     */
    public static Optional<Rol> porNombre(String nombre) {
        return Arrays.stream(values()).filter(r -> r.name().equals(nombre)).findFirst();
    }
}

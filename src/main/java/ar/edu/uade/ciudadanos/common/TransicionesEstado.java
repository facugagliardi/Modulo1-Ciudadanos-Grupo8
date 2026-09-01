package ar.edu.uade.ciudadanos.common;

import ar.edu.uade.ciudadanos.documentacion.entity.EstadoSolicitud;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

/**
 * Lista blanca de cambios de estado: para cada estado, a cuales puede pasar.
 *
 * <p>Los PATCH .../estado devuelven "400 transicion invalida", asi que el juego
 * de transiciones tiene que estar declarado en algun lado en vez de repartido
 * en ifs. Un estado que mapea al conjunto vacio es terminal.
 */
public final class TransicionesEstado {

    private static final Map<EstadoCiudadano, Set<EstadoCiudadano>> CIUDADANO =
            new EnumMap<>(EstadoCiudadano.class);
    private static final Map<EstadoOrganizacion, Set<EstadoOrganizacion>> ORGANIZACION =
            new EnumMap<>(EstadoOrganizacion.class);
    private static final Map<EstadoRepresentacion, Set<EstadoRepresentacion>> REPRESENTACION =
            new EnumMap<>(EstadoRepresentacion.class);
    private static final Map<EstadoSolicitud, Set<EstadoSolicitud>> SOLICITUD =
            new EnumMap<>(EstadoSolicitud.class);
    private static final Map<EstadoExpediente, Set<EstadoExpediente>> EXPEDIENTE =
            new EnumMap<>(EstadoExpediente.class);

    static {
        // RF-05. FALLECIDO es terminal: de ahi no se vuelve.
        CIUDADANO.put(EstadoCiudadano.ACTIVO,
                Set.of(EstadoCiudadano.INACTIVO, EstadoCiudadano.BLOQUEADO, EstadoCiudadano.FALLECIDO));
        CIUDADANO.put(EstadoCiudadano.INACTIVO,
                Set.of(EstadoCiudadano.ACTIVO, EstadoCiudadano.BLOQUEADO, EstadoCiudadano.FALLECIDO));
        CIUDADANO.put(EstadoCiudadano.BLOQUEADO,
                Set.of(EstadoCiudadano.ACTIVO, EstadoCiudadano.INACTIVO, EstadoCiudadano.FALLECIDO));
        CIUDADANO.put(EstadoCiudadano.FALLECIDO, Set.of());

        // RF-08: alta y baja de organizacion, reversibles.
        ORGANIZACION.put(EstadoOrganizacion.ACTIVA,
                Set.of(EstadoOrganizacion.INACTIVA, EstadoOrganizacion.BLOQUEADA));
        ORGANIZACION.put(EstadoOrganizacion.INACTIVA,
                Set.of(EstadoOrganizacion.ACTIVA, EstadoOrganizacion.BLOQUEADA));
        ORGANIZACION.put(EstadoOrganizacion.BLOQUEADA,
                Set.of(EstadoOrganizacion.ACTIVA, EstadoOrganizacion.INACTIVA));

        // RF-21: una representacion terminada no se reactiva, se otorga una nueva.
        REPRESENTACION.put(EstadoRepresentacion.VIGENTE,
                Set.of(EstadoRepresentacion.VENCIDA, EstadoRepresentacion.REVOCADA));
        REPRESENTACION.put(EstadoRepresentacion.VENCIDA, Set.of());
        REPRESENTACION.put(EstadoRepresentacion.REVOCADA, Set.of());

        // RF-28.
        SOLICITUD.put(EstadoSolicitud.PENDIENTE,
                Set.of(EstadoSolicitud.CUMPLIDA, EstadoSolicitud.VENCIDA));
        SOLICITUD.put(EstadoSolicitud.CUMPLIDA, Set.of());
        // Una vencida todavia puede cumplirse fuera de plazo.
        SOLICITUD.put(EstadoSolicitud.VENCIDA, Set.of(EstadoSolicitud.CUMPLIDA));

        // RF-32: el expediente avanza; archivar se puede desde cualquier punto.
        EXPEDIENTE.put(EstadoExpediente.INICIADO,
                Set.of(EstadoExpediente.EN_TRAMITE, EstadoExpediente.ARCHIVADO));
        EXPEDIENTE.put(EstadoExpediente.EN_TRAMITE,
                Set.of(EstadoExpediente.RESUELTO, EstadoExpediente.ARCHIVADO));
        EXPEDIENTE.put(EstadoExpediente.RESUELTO, Set.of(EstadoExpediente.ARCHIVADO));
        EXPEDIENTE.put(EstadoExpediente.ARCHIVADO, Set.of());
    }

    private TransicionesEstado() {
    }

    public static void exigirCiudadano(EstadoCiudadano actual, EstadoCiudadano nuevo) {
        exigir(CIUDADANO, actual, nuevo, "ciudadano");
    }

    public static void exigirOrganizacion(EstadoOrganizacion actual, EstadoOrganizacion nuevo) {
        exigir(ORGANIZACION, actual, nuevo, "organizacion");
    }

    public static void exigirRepresentacion(EstadoRepresentacion actual, EstadoRepresentacion nuevo) {
        exigir(REPRESENTACION, actual, nuevo, "representacion");
    }

    public static void exigirSolicitud(EstadoSolicitud actual, EstadoSolicitud nuevo) {
        exigir(SOLICITUD, actual, nuevo, "solicitud");
    }

    public static void exigirExpediente(EstadoExpediente actual, EstadoExpediente nuevo) {
        exigir(EXPEDIENTE, actual, nuevo, "expediente");
    }

    private static <E extends Enum<E>> void exigir(Map<E, Set<E>> permitidas, E actual, E nuevo, String entidad) {
        if (actual == nuevo) {
            throw ApiException.invalido("El " + entidad + " ya esta en estado " + nuevo);
        }
        Set<E> destinos = permitidas.getOrDefault(actual, Set.of());
        if (!destinos.contains(nuevo)) {
            String posibles = destinos.isEmpty()
                    ? "ninguno, " + actual + " es un estado final"
                    : destinos.stream().map(Enum::name).sorted().reduce((a, b) -> a + ", " + b).orElse("");
            throw ApiException.invalido(
                    "Transicion invalida de " + actual + " a " + nuevo + ". Destinos permitidos: " + posibles);
        }
    }
}

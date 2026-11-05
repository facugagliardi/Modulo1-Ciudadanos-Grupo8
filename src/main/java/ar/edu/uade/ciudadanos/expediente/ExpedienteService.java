package ar.edu.uade.ciudadanos.expediente;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.common.TransicionesEstado;
import ar.edu.uade.ciudadanos.expediente.dto.ActuacionResponse;
import ar.edu.uade.ciudadanos.expediente.dto.CrearActuacionRequest;
import ar.edu.uade.ciudadanos.expediente.dto.CrearExpedienteRequest;
import ar.edu.uade.ciudadanos.expediente.dto.ExpedienteResponse;
import ar.edu.uade.ciudadanos.expediente.dto.ResolverObraRequest;
import ar.edu.uade.ciudadanos.evento.dto.CaseFileResolvedData;
import ar.edu.uade.ciudadanos.expediente.entity.Actuacion;
import ar.edu.uade.ciudadanos.expediente.entity.ActuacionId;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.expediente.entity.Expediente;
import ar.edu.uade.ciudadanos.expediente.repository.ActuacionRepository;
import ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Expedientes y sus actuaciones (RF-30 a RF-35). */
@Service
public class ExpedienteService {

    private static final Logger log = LoggerFactory.getLogger(ExpedienteService.class);

    private final ExpedienteRepository expedienteRepository;
    private final ActuacionRepository actuacionRepository;
    private final CiudadanoDirectorioService directorio;
    private final AutorizacionService autorizacion;
    private final ObjectMapper objectMapper;
    private final EventPublisherService eventPublisherService;

    public ExpedienteService(ExpedienteRepository expedienteRepository,
                             ActuacionRepository actuacionRepository,
                             CiudadanoDirectorioService directorio,
                             AutorizacionService autorizacion,
                             ObjectMapper objectMapper) {
        this(expedienteRepository, actuacionRepository, directorio, autorizacion, objectMapper, null);
    }

    @Autowired
    public ExpedienteService(ExpedienteRepository expedienteRepository,
                             ActuacionRepository actuacionRepository,
                             CiudadanoDirectorioService directorio,
                             AutorizacionService autorizacion,
                             ObjectMapper objectMapper,
                             EventPublisherService eventPublisherService) {
        this.expedienteRepository = expedienteRepository;
        this.actuacionRepository = actuacionRepository;
        this.directorio = directorio;
        this.autorizacion = autorizacion;
        this.objectMapper = objectMapper;
        this.eventPublisherService = eventPublisherService;
    }

    /** RF-30, RF-31. Iniciar expediente es tarea de mesa de entradas. */
    @Transactional
    public ExpedienteResponse crear(CrearExpedienteRequest request) {
        autorizacion.exigir(Permiso.GESTIONAR_EXPEDIENTES, "iniciar un expediente");
        if (request.ciudadanoId() != null) directorio.exigirQueExista(request.ciudadanoId());

        String numero = request.numero() == null || request.numero().isBlank()
                ? generarNumero()
                : request.numero().trim();
        if (expedienteRepository.existsByNumero(numero)) {
            throw ApiException.conflicto("Ya existe un expediente con el numero " + numero);
        }

        Expediente expediente = new Expediente();
        expediente.setNumero(numero);
        expediente.setCiudadanoId(request.ciudadanoId());
        expediente.setCaratula(request.caratula().trim());
        expediente.setAreaIniciadora(request.areaIniciadora().trim());
        expediente.setEstado(EstadoExpediente.INICIADO);

        return armar(expedienteRepository.save(expediente));
    }

    @Transactional(readOnly = true)
    public ExpedienteResponse obtener(Long id) {
        Expediente expediente = buscar(id);
        exigirLectura(expediente);
        return armar(expediente);
    }

    /** Listado completo para internos; un titular ve solo los suyos. */
    @Transactional(readOnly = true)
    public List<ExpedienteResponse> listar() {
        if (!autorizacion.puede(Permiso.LEER_TERCEROS)
                && autorizacion.actual().tipoInfo() != ar.edu.uade.ciudadanos.security.TipoSujeto.CIUDADANO) {
            autorizacion.exigir(Permiso.LEER_TERCEROS, "listar expedientes institucionales o de terceros");
        }
        List<Expediente> expedientes = autorizacion.puede(Permiso.LEER_TERCEROS)
                ? expedienteRepository.findAll()
                : expedienteRepository.findByCiudadanoId(autorizacion.actual().id());
        return expedientes.stream().map(this::armar).toList();
    }

    /** RF-32. */
    @Transactional
    public CambioEstadoResponse cambiarEstado(Long id, EstadoExpediente nuevo) {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_EXPEDIENTE, "cambiar el estado de un expediente");
        Expediente expediente = buscarParaActualizar(id);

        if (nuevo == EstadoExpediente.RESUELTO && expediente.getPublicWorksProjectId() != null) {
            throw ApiException.invalido("Para resolver una obra debe registrar el resultado y el dictamen en /expedientes/{id}/resolucion-obra");
        }

        EstadoExpediente anterior = expediente.getEstado();
        TransicionesEstado.exigirExpediente(anterior, nuevo);
        expediente.setEstado(nuevo);

        return CambioEstadoResponse.de(id, anterior, nuevo);
    }

    /** Resultado, auditoria y outbox se confirman juntos; el bloqueo impide dos resoluciones. */
    @Transactional
    public ExpedienteResponse resolverObra(Long id, ResolverObraRequest request) {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_EXPEDIENTE, "resolver un expediente de obra");
        if (request == null || request.resultado() == null
                || !java.util.Set.of("approved", "rejected").contains(request.resultado())
                || request.resumen() == null || request.resumen().isBlank() || request.resumen().length() > 4000) {
            throw ApiException.invalido("Indique resultado approved/rejected y un resumen del dictamen de hasta 4000 caracteres");
        }
        Expediente expediente = buscarParaActualizar(id);
        if (expediente.getPublicWorksProjectId() == null) {
            throw ApiException.invalido("El expediente no esta vinculado a un proyecto de Obras Publicas");
        }
        TransicionesEstado.exigirExpediente(expediente.getEstado(), EstadoExpediente.RESUELTO);
        var correlacion = expedienteRepository.findCorrelacionObra(id)
                .orElseThrow(() -> ApiException.conflicto("No se encontro la correlacion original del proyecto"));
        var actor = autorizacion.actual();
        String resumen = request.resumen().trim();
        expediente.setEstado(EstadoExpediente.RESUELTO);
        var evento = eventPublisherService.publicarCaseFileResolved(
                CaseFileResolvedData.preparar(expediente, request.resultado(), resumen), correlacion.toString());
        expediente.registrarResolucionObra(request.resultado(), resumen,
                actor.tipoInfo() + ":" + actor.id() + ":" + actor.rol(), java.util.UUID.fromString(evento.eventId()));
        return armar(expediente);
    }

    /** RF-33, RF-34. */
    @Transactional
    public ActuacionResponse agregarActuacion(Long expedienteId, CrearActuacionRequest request) {
        autorizacion.exigir(Permiso.GESTIONAR_EXPEDIENTES, "registrar actuaciones");
        Expediente expediente = buscar(expedienteId);

        if (expediente.getEstado() == EstadoExpediente.ARCHIVADO) {
            throw ApiException.conflicto("No se pueden agregar actuaciones a un expediente archivado");
        }

        // actuacionId es el orden dentro del expediente, no un id global.
        long siguiente = actuacionRepository.findFirstByIdExpedienteIdOrderByIdActuacionIdDesc(expedienteId)
                .map(a -> a.getId().getActuacionId() + 1)
                .orElse(1L);

        Actuacion actuacion = new Actuacion();
        actuacion.setId(new ActuacionId(expedienteId, siguiente));
        actuacion.setTipo(ListasBlancas.exigir(request.tipo(), ListasBlancas.TIPOS_ACTUACION, "tipo"));
        actuacion.setDescripcion(request.descripcion().trim());
        actuacion.setModuloOrigen(request.moduloOrigen().trim());
        actuacion.setAdjuntos(serializar(request.adjuntos()));
        actuacionRepository.save(actuacion);

        return aResponse(actuacion);
    }

    /** RF-35: historial completo, en orden. */
    @Transactional(readOnly = true)
    public List<ActuacionResponse> listarActuaciones(Long expedienteId) {
        Expediente expediente = buscar(expedienteId);
        exigirLectura(expediente);

        return actuacionRepository.findByIdExpedienteIdOrderByIdActuacionIdAsc(expedienteId).stream()
                .map(this::aResponse)
                .toList();
    }

    // ------------------------------------------------------------------ helpers

    private ExpedienteResponse armar(Expediente e) {
        return new ExpedienteResponse(e.getExpedienteId(), e.getNumero(), e.getCiudadanoId(), e.getCaratula(),
                e.getAreaIniciadora(), e.getEstado(), e.getFechaInicio(),
                actuacionRepository.countByIdExpedienteId(e.getExpedienteId()), e.getPublicWorksProjectId(), e.getEstadoObra(),
                e.getResolucionObra(), e.getResumenResolucionObra(), e.getResueltoEn());
    }

    private ActuacionResponse aResponse(Actuacion a) {
        return new ActuacionResponse(a.getId().getExpedienteId(), a.getId().getActuacionId(), a.getTipo(),
                a.getDescripcion(), a.getModuloOrigen(), a.getFecha(), deserializar(a.getAdjuntos()));
    }

    /**
     * Numero legible tipo EXP-2026-000042.
     *
     * <p>Se calcula contando: bajo concurrencia dos altas simultaneas pueden
     * pedir el mismo numero y la segunda choca contra uk_expediente_numero (409).
     * Lo correcto seria una secuencia de Postgres por anio: ver README.
     */
    private String generarNumero() {
        int anio = LocalDate.now().getYear();
        long siguiente = expedienteRepository.count() + 1;
        return String.format("EXP-%d-%06d", anio, siguiente);
    }

    private String serializar(List<String> adjuntos) {
        if (adjuntos == null || adjuntos.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(adjuntos);
        } catch (JsonProcessingException e) {
            throw ApiException.invalido("No se pudieron serializar los adjuntos");
        }
    }

    /** Una fila con JSON corrupto no puede tumbar la consulta del historial. */
    private List<String> deserializar(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() { });
        } catch (JsonProcessingException e) {
            log.warn("Adjuntos con JSON invalido, se devuelven vacios: {}", json, e);
            return List.of();
        }
    }

    private void exigirLectura(Expediente expediente) {
        if (expediente.getCiudadanoId() == null
                || autorizacion.actual().tipoInfo() != ar.edu.uade.ciudadanos.security.TipoSujeto.CIUDADANO) {
            autorizacion.exigir(Permiso.LEER_TERCEROS, "consultar el expediente");
        } else {
            autorizacion.exigirLecturaDePersona(expediente.getCiudadanoId());
        }
    }

    private Expediente buscar(Long id) {
        return expedienteRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el expediente " + id));
    }

    private Expediente buscarParaActualizar(Long id) {
        return expedienteRepository.findByIdForUpdate(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el expediente " + id));
    }
}

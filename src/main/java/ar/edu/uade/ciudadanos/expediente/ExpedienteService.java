package ar.edu.uade.ciudadanos.expediente;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.common.TransicionesEstado;
import ar.edu.uade.ciudadanos.expediente.dto.ActuacionResponse;
import ar.edu.uade.ciudadanos.expediente.dto.CrearActuacionRequest;
import ar.edu.uade.ciudadanos.expediente.dto.CrearExpedienteRequest;
import ar.edu.uade.ciudadanos.expediente.dto.ExpedienteResponse;
import ar.edu.uade.ciudadanos.expediente.entity.Actuacion;
import ar.edu.uade.ciudadanos.expediente.entity.ActuacionId;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.expediente.entity.Expediente;
import ar.edu.uade.ciudadanos.expediente.repository.ActuacionRepository;
import ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository;
import ar.edu.uade.ciudadanos.persona.PersonaDirectorioService;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Expedientes y sus actuaciones (RF-30 a RF-35). */
@Service
public class ExpedienteService {

    private static final Logger log = LoggerFactory.getLogger(ExpedienteService.class);

    private final ExpedienteRepository expedienteRepository;
    private final ActuacionRepository actuacionRepository;
    private final PersonaDirectorioService directorio;
    private final AutorizacionService autorizacion;
    private final ObjectMapper objectMapper;

    public ExpedienteService(ExpedienteRepository expedienteRepository,
                             ActuacionRepository actuacionRepository,
                             PersonaDirectorioService directorio,
                             AutorizacionService autorizacion,
                             ObjectMapper objectMapper) {
        this.expedienteRepository = expedienteRepository;
        this.actuacionRepository = actuacionRepository;
        this.directorio = directorio;
        this.autorizacion = autorizacion;
        this.objectMapper = objectMapper;
    }

    /** RF-30, RF-31. Iniciar expediente es tarea de mesa de entradas. */
    @Transactional
    public ExpedienteResponse crear(CrearExpedienteRequest request) {
        autorizacion.exigir(Permiso.GESTIONAR_EXPEDIENTES, "iniciar un expediente");
        directorio.exigirQueExista(request.personaId());

        String numero = request.numero() == null || request.numero().isBlank()
                ? generarNumero()
                : request.numero().trim();
        if (expedienteRepository.existsByNumero(numero)) {
            throw ApiException.conflicto("Ya existe un expediente con el numero " + numero);
        }

        Expediente expediente = new Expediente();
        expediente.setNumero(numero);
        expediente.setPersonaId(request.personaId());
        expediente.setCaratula(request.caratula().trim());
        expediente.setAreaIniciadora(request.areaIniciadora().trim());
        expediente.setEstado(EstadoExpediente.INICIADO);

        return armar(expedienteRepository.save(expediente));
    }

    @Transactional(readOnly = true)
    public ExpedienteResponse obtener(Long id) {
        Expediente expediente = buscar(id);
        autorizacion.exigirLecturaDePersona(expediente.getPersonaId());
        return armar(expediente);
    }

    /** Listado completo para internos; un titular ve solo los suyos. */
    @Transactional(readOnly = true)
    public List<ExpedienteResponse> listar() {
        List<Expediente> expedientes = autorizacion.puede(Permiso.LEER_TERCEROS)
                ? expedienteRepository.findAll()
                : expedienteRepository.findByPersonaId(autorizacion.actual().id());
        return expedientes.stream().map(this::armar).toList();
    }

    /** RF-32. */
    @Transactional
    public CambioEstadoResponse cambiarEstado(Long id, EstadoExpediente nuevo) {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_EXPEDIENTE, "cambiar el estado de un expediente");
        Expediente expediente = buscar(id);

        EstadoExpediente anterior = expediente.getEstado();
        TransicionesEstado.exigirExpediente(anterior, nuevo);
        expediente.setEstado(nuevo);

        return CambioEstadoResponse.de(id, anterior, nuevo);
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
        autorizacion.exigirLecturaDePersona(expediente.getPersonaId());

        return actuacionRepository.findByIdExpedienteIdOrderByIdActuacionIdAsc(expedienteId).stream()
                .map(this::aResponse)
                .toList();
    }

    // ------------------------------------------------------------------ helpers

    private ExpedienteResponse armar(Expediente e) {
        return new ExpedienteResponse(e.getExpedienteId(), e.getNumero(), e.getPersonaId(), e.getCaratula(),
                e.getAreaIniciadora(), e.getEstado(), e.getFechaInicio(),
                actuacionRepository.countByIdExpedienteId(e.getExpedienteId()));
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

    private Expediente buscar(Long id) {
        return expedienteRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el expediente " + id));
    }
}

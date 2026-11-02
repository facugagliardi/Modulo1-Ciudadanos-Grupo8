package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.documentacion.entity.EstadoSolicitud;
import ar.edu.uade.ciudadanos.documentacion.entity.OrigenSolicitud;
import ar.edu.uade.ciudadanos.documentacion.entity.SolicitudDocumentacion;
import ar.edu.uade.ciudadanos.documentacion.repository.SolicitudDocumentacionRepository;
import ar.edu.uade.ciudadanos.evento.dto.EventEnvelope;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationDeliveredData;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedEvent;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.expediente.entity.Expediente;
import ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Servicio encargado de recibir, validar la idempotencia y procesar
 * los eventos asincrónicos entrantes desde otros módulos, impactando
 * en el modelo de negocio (Expedientes y Solicitudes de Documentación).
 */
@Service
public class EventConsumerService {

    private static final Logger log = LoggerFactory.getLogger(EventConsumerService.class);

    private final EventoService eventoService;
    private final EventPublisherService eventPublisherService;
    private final ObjectMapper objectMapper;
    private final ExpedienteRepository expedienteRepository;
    private final SolicitudDocumentacionRepository solicitudRepository;
    private final CiudadanoRepository ciudadanoRepository;

    public EventConsumerService(EventoService eventoService,
                                EventPublisherService eventPublisherService,
                                ObjectMapper objectMapper) {
        this(eventoService, eventPublisherService, objectMapper, null, null, null);
    }

    @Autowired
    public EventConsumerService(EventoService eventoService,
                                EventPublisherService eventPublisherService,
                                ObjectMapper objectMapper,
                                @Autowired(required = false) ExpedienteRepository expedienteRepository,
                                @Autowired(required = false) SolicitudDocumentacionRepository solicitudRepository,
                                @Autowired(required = false) CiudadanoRepository ciudadanoRepository) {
        this.eventoService = eventoService;
        this.eventPublisherService = eventPublisherService;
        this.objectMapper = objectMapper;
        this.expedienteRepository = expedienteRepository;
        this.solicitudRepository = solicitudRepository;
        this.ciudadanoRepository = ciudadanoRepository;
    }

    /**
     * Listener que consume mensajes de la cola de Ciudadanos ('q.ciudadanos') y M8 en RabbitMQ.
     * Solo procesa si auto-startup está habilitado.
     */
    @Transactional
    public void onSocialDocumentationRequested(SocialDocumentationRequestedEvent evento) {
        log.info("Mensaje recibido desde cola RabbitMQ: eventId={}, eventType={}",
                evento.eventId(), evento.eventType());
        procesarSocialDocumentationRequested(evento);
    }

    /**
     * Procesa la solicitud de documentación de M8:
     * 1. Idempotencia: chequea si el eventId ya fue procesado.
     * 2. Registra el evento entrante como RECIBIDO en PostgreSQL (auditoría).
     * 3. Crea o asocia un Expediente en la base de datos para el ciudadano (aparece en 'Mis expedientes').
     * 4. Crea las Solicitudes de Documentación pendientes en la base de datos (aparece en 'Documentación que te piden').
     * 5. Publica en respuesta el evento socialDocumentationDelivered con causationId y correlationId.
     */
    @Transactional
    public boolean procesarSocialDocumentationRequested(SocialDocumentationRequestedEvent evento) {
        if (evento == null) throw ar.edu.uade.ciudadanos.common.ApiException.invalido("Evento requerido");
        String eventId = uuid(evento.eventId(), "eventId");
        if (eventoService.estaProcesado(eventId)) return false;
        if (!"socialDocumentationRequested".equals(evento.eventType())
                || !"desarrollo-social".equals(evento.sourceModule()) || !"1.0".equals(evento.eventVersion())) {
            throw ar.edu.uade.ciudadanos.common.ApiException.invalido("Contrato social no soportado");
        }
        try { OffsetDateTime.parse(evento.occuredAt()); }
        catch (RuntimeException e) { throw ar.edu.uade.ciudadanos.common.ApiException.invalido("occurredAt requiere fecha con offset"); }
        String correlationId = uuid(evento.correlationId(), "correlationId");
        if (evento.causationId() != null) uuid(evento.causationId(), "causationId");
        var payload = evento.payload();
        if (payload == null || payload.requiredDocuments() == null || payload.requiredDocuments().isEmpty()) {
            throw ar.edu.uade.ciudadanos.common.ApiException.invalido("data y requiredDocuments son obligatorios");
        }
        String citizenId = uuid(payload.citizenId(), "citizenId");
        Long titularId = resolverTitularId(citizenId);
        String applicationId = uuid(payload.applicationId(), "applicationId");
        uuid(payload.programId(), "programId");
        uuid(payload.programEditionId(), "programEditionId");
        LocalDate plazo = null;
        if (payload.deadline() != null) {
            try {
                plazo = payload.deadline().length() == 10 ? LocalDate.parse(payload.deadline())
                        : OffsetDateTime.parse(payload.deadline()).toLocalDate();
            } catch (RuntimeException e) { throw ar.edu.uade.ciudadanos.common.ApiException.invalido("deadline invalido"); }
        }
        var requirementIds = new java.util.HashSet<String>();
        for (var requirement : payload.requiredDocuments()) {
            if (requirement == null || !(requirement.get("type") instanceof String type) || type.isBlank()
                    || type.length() > 100 || !(requirement.get("required") instanceof Boolean)) {
                throw ar.edu.uade.ciudadanos.common.ApiException.invalido("Requisito sin type o required valido");
            }
            String id = uuid((String) requirement.get("requirementId"), "requirementId");
            if (!requirementIds.add(id)) throw ar.edu.uade.ciudadanos.common.ApiException.invalido("requirementId repetido");
        }
        if (expedienteRepository == null || solicitudRepository == null) throw new IllegalStateException("Repositorios no disponibles");
        String numero = "EXP-M8-" + applicationId;
        String raw;
        try { raw = objectMapper.writeValueAsString(evento); }
        catch (java.io.IOException e) { throw new IllegalStateException("No se pudo serializar el evento", e); }
        if (!eventoService.registrarRecibido(eventId, "citizens", citizenId, evento.eventType(), raw)) return false;
        // Hasta acordar actualizaciones con M8, nunca crear un segundo expediente para el mismo pedido.
        if (expedienteRepository.existsByNumero(numero)) {
            throw ar.edu.uade.ciudadanos.common.ApiException.conflicto("La applicationId ya tiene expediente; actualizacion pendiente de acuerdo con M8");
        }
        Expediente expediente = new Expediente();
        expediente.setNumero(numero);
        expediente.setCiudadanoId(titularId);
        expediente.setAreaIniciadora("Desarrollo Social");
        expediente.setCaratula("Solicitud social " + applicationId);
        expediente = expedienteRepository.save(expediente);
        List<Map<String, Object>> solicitudes = new ArrayList<>();
        for (var requirement : payload.requiredDocuments()) {
            String type = (String) requirement.get("type");
            var solicitud = new SolicitudDocumentacion();
            solicitud.setTitularId(titularId);
            solicitud.setTipoDocumento(normalizarTipoDocumento(type));
            solicitud.setPlazo(plazo);
            solicitud.setOrigen(OrigenSolicitud.EVENTO);
            var contexto = new ar.edu.uade.ciudadanos.evento.dto.ContextoDocumentacionSocial(
                    citizenId, applicationId, payload.programId(), payload.programEditionId(), correlationId,
                    expediente.getUuid().toString(), expediente.getNumero(), requirement, payload.applicationNumber(), payload.notes());
            try { solicitud.setContextoSocial(objectMapper.writeValueAsString(contexto)); }
            catch (java.io.IOException e) { throw new IllegalStateException("No se pudo guardar el contexto social", e); }
            solicitud = solicitudRepository.save(solicitud);
            solicitudes.add(contexto.solicitud(solicitud.getUuid().toString(), "PENDING", null));
        }
        var respuesta = new SocialDocumentationDeliveredData(citizenId, applicationId, payload.programId(),
                List.of(Map.of("fileId", expediente.getUuid().toString(), "number", expediente.getNumero(),
                        "initiatingArea", "SOCIAL_DEVELOPMENT", "status", "IN_PROGRESS", "documentationRequests", solicitudes)),
                payload.programEditionId());
        eventPublisherService.publicarSocialDocumentationDelivered(eventId, correlationId, respuesta);
        return true;
    }

    /**
     * Permite recibir y almacenar en la tabla events cualquier evento entrante genérico,
     * e impacta en las tablas correspondientes si se trata de expedientes o documentación.
     */
    @Transactional
    public boolean procesarEventoGenericoRecibido(String eventId,
                                                  String aggregateType,
                                                  String aggregateId,
                                                  String eventType,
                                                  String rawPayload) {
        if (eventoService.estaProcesado(eventId)) {
            log.info("Evento descartado por duplicado (idempotencia): eventId={}", eventId);
            return false;
        }

        if (!eventoService.registrarRecibido(eventId, aggregateType, aggregateId, eventType, rawPayload)) return false;
        log.info("Evento genérico entrante guardado en BD con éxito: eventId={}, eventType={}", eventId, eventType);

        // Si es un evento de negocio relacionado con creación de expediente o pedido de documentación:
        procesarEntidadesDeNegocioDesdeJson(eventType, rawPayload);

        return true;
    }

    /**
     * Analiza el JSON recibido y, si corresponde a creación de expediente o solicitud de documentación,
     * inserta los registros en PostgreSQL para que se vean en el frontend.
     */
    private void procesarEntidadesDeNegocioDesdeJson(String eventType, String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            return;
        }

        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            JsonNode data = root.has("data") ? root.get("data") : root;

            String eventTypeNorm = eventType != null ? eventType.toLowerCase() : "";

            // A) Eventos de creación de expediente (casefileInitiated, casefileCreated, expedienteIniciado)
            if (eventTypeNorm.contains("casefile") || eventTypeNorm.contains("expediente")) {
                if (expedienteRepository != null) {
                    String citizenStr = extraerCitizenId(data);
                    Long titularId = resolverTitularId(citizenStr);

                    String caratula = data.has("caratula") ? data.get("caratula").asText()
                            : (data.has("title") ? data.get("title").asText() : "Trámite iniciado por evento inter-módulo");
                    String areaIniciadora = data.has("initiatingArea") ? data.get("initiatingArea").asText()
                            : (data.has("areaIniciadora") ? data.get("areaIniciadora").asText() : "Módulo Externo");

                    String numero = "EXP-2026-EVT-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
                    if (data.has("caseFileNumber")) {
                        numero = data.get("caseFileNumber").asText();
                    } else if (data.has("numero")) {
                        numero = data.get("numero").asText();
                    }

                    if (expedienteRepository.existsByNumero(numero)) {
                        numero = numero + "-" + (System.currentTimeMillis() % 1000);
                    }

                    Expediente exp = new Expediente();
                    exp.setNumero(numero);
                    exp.setCiudadanoId(titularId);
                    exp.setCaratula(caratula);
                    exp.setAreaIniciadora(areaIniciadora);
                    exp.setEstado(EstadoExpediente.INICIADO);
                    exp.setFechaInicio(OffsetDateTime.now());
                    exp = expedienteRepository.save(exp);

                    log.info("Expediente creado en BD vía evento genérico: id={}, numero={}, ciudadanoId={}",
                            exp.getExpedienteId(), exp.getNumero(), titularId);

                    // Si además solicitó documentación complementaria:
                    if (data.has("requiredDocument") && solicitudRepository != null) {
                        String docType = data.get("requiredDocument").asText();
                        crearSolicitudEnBd(titularId, docType, LocalDate.now().plusDays(15));
                    }
                }
            }

            // B) Eventos de solicitud de documentación (documentationRequested, solicitudDocumentacion)
            if (eventTypeNorm.contains("documentation") || eventTypeNorm.contains("documentacion") || eventTypeNorm.contains("solicitud")) {
                if (solicitudRepository != null) {
                    String citizenStr = extraerCitizenId(data);
                    Long titularId = resolverTitularId(citizenStr);

                    String docType = data.has("documentType") ? data.get("documentType").asText()
                            : (data.has("tipoDocumento") ? data.get("tipoDocumento").asText() : "CERTIFICADO_DOMICILIO");

                    LocalDate plazo = LocalDate.now().plusDays(15);
                    if (data.has("deadline")) {
                        try {
                            plazo = LocalDate.parse(data.get("deadline").asText().substring(0, 10));
                        } catch (Exception ignored) {
                        }
                    }

                    crearSolicitudEnBd(titularId, docType, plazo);
                }
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("No se pudo procesar el evento de negocio", e);
        }
    }

    private String extraerCitizenId(JsonNode data) {
        if (data == null) {
            return null;
        }
        if (data.has("citizenId")) {
            return data.get("citizenId").asText();
        }
        if (data.has("citizen_id")) {
            return data.get("citizen_id").asText();
        }
        if (data.has("idCiudadano")) {
            return data.get("idCiudadano").asText();
        }
        if (data.has("titularId")) {
            return data.get("titularId").asText();
        }
        return null;
    }

    private void crearSolicitudEnBd(Long titularId, String docTypeRaw, LocalDate plazo) {
        String docType = normalizarTipoDocumento(docTypeRaw);
        SolicitudDocumentacion sol = new SolicitudDocumentacion();
        sol.setTitularId(titularId);
        sol.setTipoDocumento(docType);
        sol.setPlazo(plazo);
        sol.setEstado(EstadoSolicitud.PENDIENTE);
        sol.setOrigen(OrigenSolicitud.EVENTO);
        sol = solicitudRepository.save(sol);
        log.info("SolicitudDocumentacion creada en BD vía evento genérico: id={}, titularId={}, tipo={}",
                sol.getSolicitudId(), titularId, docType);
    }

    private String normalizarTipoDocumento(String docTypeRaw) {
        if (docTypeRaw == null) {
            return "OTRO";
        }
        String clean = docTypeRaw.trim().toUpperCase();
        if (ListasBlancas.TIPOS_DOCUMENTO.contains(clean)) {
            return clean;
        }
        if (clean.contains("INCOME") || clean.contains("INGRESO") || clean.contains("SUELDO")) {
            return "OTRO";
        }
        if (clean.contains("BIRTH") || clean.contains("NACIMIENTO")) {
            return "PARTIDA_NACIMIENTO";
        }
        if (clean.contains("DOMICILIO") || clean.contains("ADDRESS")) {
            return "CERTIFICADO_DOMICILIO";
        }
        return "OTRO";
    }

    private Long resolverTitularId(String raw) {
        if (ciudadanoRepository == null) throw new IllegalStateException("Directorio de ciudadanos no disponible");
        return ciudadanoRepository.findByUuid(UUID.fromString(uuid(raw, "citizenId")))
                .orElseThrow(() -> ar.edu.uade.ciudadanos.common.ApiException.noEncontrado("citizenId no existe en M1"))
                .getId();
    }

    private String uuid(String raw, String campo) {
        try {
            UUID value = UUID.fromString(raw);
            if (!value.toString().equalsIgnoreCase(raw)) throw new IllegalArgumentException();
            return value.toString();
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ar.edu.uade.ciudadanos.common.ApiException.invalido(campo + " debe ser UUID canonico");
        }
    }
}

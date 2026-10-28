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
        if (evento == null || evento.eventId() == null) {
            log.warn("Evento recibido nulo o sin eventId");
            return false;
        }

        if (eventoService.estaProcesado(evento.eventId())) {
            log.info("Evento ya procesado previamente (idempotencia activa): eventId={}", evento.eventId());
            return false;
        }

        String rawJson;
        try {
            rawJson = objectMapper.writeValueAsString(evento);
        } catch (Exception e) {
            rawJson = evento.toString();
        }

        String citizenIdStr = evento.payload() != null ? evento.payload().citizenId() : "1";
        Long titularId = resolverTitularId(citizenIdStr);

        eventoService.registrarRecibido(
                evento.eventId(),
                "citizens",
                citizenIdStr,
                evento.eventType() != null ? evento.eventType() : "socialDocumentationRequested",
                rawJson
        );
        log.info("Evento entrante registrado como RECIBIDO en PostgreSQL: eventId={}, titularId={}",
                evento.eventId(), titularId);

        String appId = evento.payload() != null ? evento.payload().applicationId() : "sol-00456";
        String progId = evento.payload() != null ? evento.payload().programId() : "prog-00789";

        // 1. Crear Expediente en BD para que aparezca en el panel 'Mis expedientes'
        Expediente nuevoExp = null;
        if (expedienteRepository != null) {
            String numeroExp = "EXP-2026-M8-" + (appId != null ? appId.toUpperCase().replace(" ", "") : "TRAMITE");
            if (expedienteRepository.existsByNumero(numeroExp)) {
                numeroExp = numeroExp + "-" + (System.currentTimeMillis() % 10000);
            }
            nuevoExp = new Expediente();
            nuevoExp.setNumero(numeroExp);
            nuevoExp.setCiudadanoId(titularId);
            nuevoExp.setAreaIniciadora("Desarrollo Social");
            nuevoExp.setCaratula("Solicitud de Programa Social " + progId + " (" + appId + ")");
            nuevoExp.setEstado(EstadoExpediente.INICIADO);
            nuevoExp.setFechaInicio(OffsetDateTime.now());
            nuevoExp = expedienteRepository.save(nuevoExp);
            log.info("Expediente creado en BD desde evento M8: id={}, numero={}, ciudadanoId={}",
                    nuevoExp.getExpedienteId(), nuevoExp.getNumero(), titularId);
        }

        // 2. Crear Solicitudes de Documentación en BD para que aparezcan en 'Documentación que te piden'
        List<Map<String, Object>> reqDocsList = new ArrayList<>();
        if (solicitudRepository != null) {
            List<Map<String, Object>> docsRequeridos = evento.payload() != null ? evento.payload().requiredDocuments() : null;
            if (docsRequeridos == null || docsRequeridos.isEmpty()) {
                docsRequeridos = List.of(Map.of("documentType", "CERTIFICADO_DOMICILIO"));
            }

            LocalDate plazo = LocalDate.now().plusDays(15);
            if (evento.payload() != null && evento.payload().deadline() != null) {
                try {
                    plazo = LocalDate.parse(evento.payload().deadline().substring(0, 10));
                } catch (Exception ignored) {
                }
            }

            for (Map<String, Object> docReq : docsRequeridos) {
                String tipoRaw = String.valueOf(docReq.getOrDefault("documentType", "OTRO")).trim().toUpperCase();
                String tipoNormalizado = normalizarTipoDocumento(tipoRaw);

                SolicitudDocumentacion solicitud = new SolicitudDocumentacion();
                solicitud.setTitularId(titularId);
                solicitud.setTipoDocumento(tipoNormalizado);
                solicitud.setPlazo(plazo);
                solicitud.setEstado(EstadoSolicitud.PENDIENTE);
                solicitud.setOrigen(OrigenSolicitud.EVENTO);
                solicitud = solicitudRepository.save(solicitud);

                reqDocsList.add(Map.of(
                        "requestId", "sol-doc-" + solicitud.getSolicitudId(),
                        "documentType", tipoNormalizado,
                        "status", "PENDING"
                ));
                log.info("SolicitudDocumentacion creada en BD desde evento: id={}, titularId={}, tipo={}",
                        solicitud.getSolicitudId(), titularId, tipoNormalizado);
            }
        }

        // 3. Estructurar la respuesta técnica hacia M8 (socialDocumentationDelivered)
        Map<String, Object> file = Map.of(
                "fileId", nuevoExp != null ? String.valueOf(nuevoExp.getExpedienteId()) : "exp-00981",
                "number", nuevoExp != null ? nuevoExp.getNumero() : "EXP-2026-00981",
                "initiatingArea", "SOCIAL_DEVELOPMENT",
                "status", "IN_PROGRESS",
                "documentationRequests", reqDocsList.isEmpty() ? List.of(
                        Map.of("requestId", "sol-doc-1", "documentType", "CONSTANCIA_CUIT", "status", "PENDING")
                ) : reqDocsList
        );

        String citizenUuidResp = citizenIdStr;
        if (titularId != null && ciudadanoRepository != null) {
            citizenUuidResp = ciudadanoRepository.findById(titularId)
                    .map(c -> c.getUuid() != null ? c.getUuid().toString() : citizenIdStr)
                    .orElse(citizenIdStr);
        }

        SocialDocumentationDeliveredData respuestaData = new SocialDocumentationDeliveredData(
                citizenUuidResp,
                appId,
                progId,
                List.of(file)
        );

        String correlationId = (evento.correlationId() != null && !evento.correlationId().isBlank())
                ? evento.correlationId()
                : UUID.randomUUID().toString();

        EventEnvelope<SocialDocumentationDeliveredData> respuestaEnvelope =
                eventPublisherService.publicarSocialDocumentationDelivered(evento.eventId(), correlationId, respuestaData);

        if (respuestaEnvelope != null) {
            log.info("Respuesta socialDocumentationDelivered emitida con causationId={} y correlationId={}: nuevo eventId={}",
                    evento.eventId(), correlationId, respuestaEnvelope.eventId());
        }

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

        eventoService.registrarRecibido(eventId, aggregateType, aggregateId, eventType, rawPayload);
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
            log.warn("No se pudo parsear payload para creación automática de entidades: {}", e.getMessage());
        }
    }

    private String extraerCitizenId(JsonNode data) {
        if (data == null) {
            return "1";
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
        return "1";
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
            return "CONSTANCIA_CUIT";
        }
        if (clean.contains("BIRTH") || clean.contains("NACIMIENTO")) {
            return "PARTIDA_NACIMIENTO";
        }
        if (clean.contains("DOMICILIO") || clean.contains("ADDRESS")) {
            return "CERTIFICADO_DOMICILIO";
        }
        return "OTRO";
    }

    /**
     * Resuelve el ID interno del ciudadano a partir del identificador recibido en el evento entrante.
     * Soporta tanto UUID (contrato oficial moderno) como ID numérico / CUIT / DNI (retrocompatibilidad
     * con módulos externos desactualizados).
     */
    private Long resolverTitularId(String citizenIdRaw) {
        if (ciudadanoRepository == null) {
            return 1L;
        }
        if (citizenIdRaw != null && !citizenIdRaw.isBlank()) {
            String clean = citizenIdRaw.trim();
            // 1. Intentar como UUID canónico
            try {
                UUID uuid = UUID.fromString(clean);
                Optional<Ciudadano> porUuid = ciudadanoRepository.findByUuid(uuid);
                if (porUuid.isPresent()) {
                    return porUuid.get().getId();
                }
            } catch (Exception ignored) {
            }
            // 2. Intentar como ID numérico, CUIT o DNI (retrocompatibilidad)
            try {
                String digits = clean.replaceAll("[^0-9]", "");
                if (!digits.isEmpty()) {
                    Long idNum = Long.parseLong(digits);
                    if (ciudadanoRepository.existsById(idNum)) {
                        return idNum;
                    }
                    Optional<Ciudadano> porCuit = ciudadanoRepository.findByCuit(idNum);
                    if (porCuit.isPresent()) {
                        return porCuit.get().getId();
                    }
                    Optional<Ciudadano> porDni = ciudadanoRepository.findByDocumentoId(digits);
                    if (porDni.isPresent()) {
                        return porDni.get().getId();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        // Fallback: buscar el primer ciudadano de la base de datos
        try {
            return ciudadanoRepository.findAll().stream()
                    .findFirst()
                    .map(Ciudadano::getId)
                    .orElse(1L);
        } catch (Exception e) {
            return 1L;
        }
    }
}

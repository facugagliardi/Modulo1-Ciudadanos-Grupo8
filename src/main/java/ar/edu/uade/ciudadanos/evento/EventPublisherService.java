package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.evento.dto.CaseFileResolvedData;
import ar.edu.uade.ciudadanos.evento.dto.CitizenInfoDeliveredData;
import ar.edu.uade.ciudadanos.evento.dto.CitizenUpdatedData;
import ar.edu.uade.ciudadanos.evento.dto.EventEnvelope;
import ar.edu.uade.ciudadanos.evento.dto.OrganizationInfoDeliveredData;
import ar.edu.uade.ciudadanos.evento.dto.OrganizationRegisteredData;
import ar.edu.uade.ciudadanos.evento.dto.ProducerInfo;
import ar.edu.uade.ciudadanos.evento.dto.RepresentationExpiredData;
import ar.edu.uade.ciudadanos.evento.dto.RepresentationGrantedData;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationDeliveredData;
import ar.edu.uade.ciudadanos.evento.dto.UpdatedBy;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Servicio centralizado para la emision de eventos asincronicos.
 * Garantiza la persistencia en la tabla events de PostgreSQL (patron Outbox)
 * y la publicacion en el broker RabbitMQ.
 */
@Service
public class EventPublisherService {

    private static final Logger log = LoggerFactory.getLogger(EventPublisherService.class);

    private final EventoService eventoService;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.events.exchange:modulo1.topic.exchange}")
    private String exchangeName;

    public EventPublisherService(EventoService eventoService,
                                 RabbitTemplate rabbitTemplate,
                                 ObjectMapper objectMapper) {
        this.eventoService = eventoService;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Publica cualquier EventEnvelope generico:
     * 1. Guarda en PostgreSQL (tabla events) con TipoEvento.EMITIDO.
     * 2. Intenta enviar a RabbitMQ. Si el broker no esta disponible, registra warning sin cortar la transaccion.
     */
    @Transactional
    public <T> EventEnvelope<T> publicar(EventEnvelope<T> envelope, String routingKey) {
        try {
            String payloadJson = objectMapper.writeValueAsString(envelope);
            eventoService.registrarEmitido(envelope.eventId(), envelope.subject(), envelope.eventType(), payloadJson);
            log.info("Evento persistido localmente: eventId={}, eventType={}", envelope.eventId(), envelope.eventType());
        } catch (Exception ex) {
            log.error("Error al serializar y persistir el evento en PostgreSQL: {}", ex.getMessage(), ex);
            throw new IllegalStateException("No se pudo registrar el evento emitido", ex);
        }

        try {
            rabbitTemplate.convertAndSend(exchangeName, routingKey, envelope);
            log.info("Evento despachado a RabbitMQ: exchange={}, routingKey={}, eventId={}",
                    exchangeName, routingKey, envelope.eventId());
        } catch (Exception ex) {
            log.warn("RabbitMQ no disponible al despachar evento {}. " +
                    "El evento quedo registrado en la base de datos de eventos para posterior reintento. Detalle: {}",
                    envelope.eventId(), ex.getMessage());
        }

        return envelope;
    }

    // ------------------------------------------------ Metodos de negocio

    /**
     * 1. citizenUpdated (M1 -> M2 y M5)
     */
    public EventEnvelope<CitizenUpdatedData> publicarCitizenUpdated(Long citizenId,
                                                                   String updateType,
                                                                   Map<String, Object> details,
                                                                   UpdatedBy updatedBy) {
        String eventId = generarEventId();
        String occurredAt = fechaActualIso();
        CitizenUpdatedData data = new CitizenUpdatedData(citizenId, updateType, details, updatedBy);
        EventEnvelope<CitizenUpdatedData> envelope = EventEnvelope.de(
                eventId,
                occurredAt,
                "citizenUpdated",
                ProducerInfo.citizensApi(),
                "citizens/" + citizenId,
                data
        );
        return publicar(envelope, "modulo1.citizens." + updateType.toLowerCase());
    }

    /**
     * 2. casefileResolved (M1 -> M3 Obras Publicas)
     */
    public EventEnvelope<CaseFileResolvedData> publicarCasefileResolved(CaseFileResolvedData data) {
        String eventId = generarEventId();
        String occurredAt = fechaActualIso();
        EventEnvelope<CaseFileResolvedData> envelope = EventEnvelope.de(
                eventId,
                occurredAt,
                "casefileResolved",
                ProducerInfo.expedientesApi(),
                "caseFiles/" + data.caseFileId(),
                data
        );
        return publicar(envelope, "modulo1.casefiles.resolved");
    }

    /**
     * 3. citizenInfoDelivered (M1 -> M6 Ambiente)
     */
    public EventEnvelope<CitizenInfoDeliveredData> publicarCitizenInfoDelivered(Long citizenId,
                                                                               String correlationId,
                                                                               CitizenInfoDeliveredData data) {
        String eventId = generarEventId();
        String occurredAt = fechaActualIso();
        EventEnvelope<CitizenInfoDeliveredData> envelope = EventEnvelope.de(
                eventId,
                occurredAt,
                "citizenInfoDelivered",
                ProducerInfo.citizensApi(),
                "citizens/" + citizenId,
                correlationId,
                data
        );
        return publicar(envelope, "modulo1.citizens.infodelivered");
    }

    /**
     * 4. organizationInfoDelivered (M1 -> M6 Ambiente)
     */
    public EventEnvelope<OrganizationInfoDeliveredData> publicarOrganizationInfoDelivered(Long cuit,
                                                                                         String correlationId,
                                                                                         OrganizationInfoDeliveredData data) {
        String eventId = generarEventId();
        String occurredAt = fechaActualIso();
        EventEnvelope<OrganizationInfoDeliveredData> envelope = EventEnvelope.de(
                eventId,
                occurredAt,
                "organizationInfoDelivered",
                ProducerInfo.organizationsApi(),
                "organizations/" + cuit,
                correlationId,
                data
        );
        return publicar(envelope, "modulo1.organizations.infodelivered");
    }

    /**
     * 5. organizationRegistered (M1 -> inter-modulo)
     */
    public EventEnvelope<OrganizationRegisteredData> publicarOrganizationRegistered(Long cuit,
                                                                                   OrganizationRegisteredData data) {
        String eventId = generarEventId();
        String occurredAt = fechaActualIso();
        EventEnvelope<OrganizationRegisteredData> envelope = EventEnvelope.de(
                eventId,
                occurredAt,
                "organizationRegistered",
                ProducerInfo.organizationsApi(),
                "organizations/" + cuit,
                data
        );
        return publicar(envelope, "modulo1.organizations.registered");
    }

    /**
     * 6. representationGranted (M1 -> inter-modulo)
     */
    public EventEnvelope<RepresentationGrantedData> publicarRepresentationGranted(Long representationId,
                                                                                 RepresentationGrantedData data) {
        String eventId = generarEventId();
        String occurredAt = fechaActualIso();
        EventEnvelope<RepresentationGrantedData> envelope = EventEnvelope.de(
                eventId,
                occurredAt,
                "representationGranted",
                ProducerInfo.organizationsApi(),
                "representations/" + representationId,
                data
        );
        return publicar(envelope, "modulo1.representations.granted");
    }

    /**
     * 7. representationExpired (M1 -> inter-modulo)
     */
    public EventEnvelope<RepresentationExpiredData> publicarRepresentationExpired(Long representationId,
                                                                                 RepresentationExpiredData data) {
        String eventId = generarEventId();
        String occurredAt = fechaActualIso();
        EventEnvelope<RepresentationExpiredData> envelope = EventEnvelope.de(
                eventId,
                occurredAt,
                "representationExpired",
                ProducerInfo.organizationsApi(),
                "representations/" + representationId,
                data
        );
        return publicar(envelope, "modulo1.representations.expired");
    }

    /**
     * 8. socialDocumentationDelivered (M1 -> M8 Desarrollo Social)
     */
    public EventEnvelope<SocialDocumentationDeliveredData> publicarSocialDocumentationDelivered(String correlationId,
                                                                                               SocialDocumentationDeliveredData data) {
        String eventId = generarEventId();
        String occurredAt = fechaActualIso();
        EventEnvelope<SocialDocumentationDeliveredData> envelope = EventEnvelope.de(
                eventId,
                occurredAt,
                "socialDocumentationDelivered",
                ProducerInfo.expedientesApi(),
                "citizens/" + data.citizenId(),
                correlationId,
                data
        );
        return publicar(envelope, "modulo1.social.documentation.delivered");
    }

    // ------------------------------------------------ Generacion de Ejemplos del PDF

    /**
     * Permite publicar cualquiera de los ejemplos oficiales del catalogo del TP
     * con payloads identicos a los documentados en la especificacion.
     */
    public EventEnvelope<?> publicarEjemplo(String ejemploKey) {
        String normalizado = ejemploKey.toLowerCase().replace("_", "-");
        return switch (normalizado) {
            case "citizen-registered" -> {
                Map<String, Object> address = Map.of(
                        "propertyId", 5501,
                        "street", "Av. Rivadavia",
                        "number", "1450",
                        "primary", true,
                        "effectiveFrom", "2026-08-20"
                );
                Map<String, Object> details = Map.of(
                        "dni", "34567890",
                        "cuil", "20345678901",
                        "name", "Marcos",
                        "lastname", "Ferreyra",
                        "birthdate", "1990-04-12",
                        "state", "ACTIVE",
                        "nationality", "argentina",
                        "address", address
                );
                yield publicarCitizenUpdated(8452L, "REGISTERED", details, UpdatedBy.selfService());
            }
            case "citizen-blocked" -> {
                Map<String, Object> details = Map.of(
                        "reason", "DOCUMENTACION_APOCRIFA",
                        "reviewRequired", true
                );
                yield publicarCitizenUpdated(8452L, "BLOCKED", details, UpdatedBy.areaUser("USR-M1-14"));
            }
            case "citizen-deceased" -> {
                Map<String, Object> details = Map.of(
                        "deceasedAt", "2026-08-19",
                        "source", "REGISTRO_CIVIL"
                );
                yield publicarCitizenUpdated(8452L, "DECEASED", details, UpdatedBy.areaUser("USR-M1-09"));
            }
            case "citizen-address-updated" -> {
                Map<String, Object> prev = Map.of(
                        "propertyId", 5501,
                        "street", "Av. Rivadavia",
                        "number", "1450",
                        "effectiveUntil", "2026-08-21"
                );
                Map<String, Object> next = Map.of(
                        "propertyId", 5602,
                        "street", "San Martín",
                        "number", "870",
                        "primary", true,
                        "effectiveFrom", "2026-08-22"
                );
                Map<String, Object> details = Map.of(
                        "previousAddress", prev,
                        "newAddress", next
                );
                yield publicarCitizenUpdated(8452L, "ADDRESS_UPDATED", details, UpdatedBy.areaUser("USR-M1-14"));
            }
            case "casefile-resolved" -> {
                CaseFileResolvedData data = new CaseFileResolvedData(
                        1042L,
                        "EXP-2026-001042",
                        "resolved",
                        "approved",
                        "Obras Públicas",
                        "Aprobación y autorización de ejecución de obra pública",
                        84L,
                        Map.of("type", "PUBLIC_WORKS_PROJECT", "id", "OBRA-8832"),
                        "Dictamen administrativo favorable. Se autoriza la ejecución de la obra conforme al pliego técnico.",
                        UpdatedBy.areaUser(32424L),
                        fechaActualIso()
                );
                yield publicarCasefileResolved(data);
            }
            case "citizen-info-delivered" -> {
                CitizenInfoDeliveredData data = new CitizenInfoDeliveredData(
                        8452L,
                        "Marcos Ferreyra",
                        "34567890",
                        "+54 11 4455-6677",
                        "marcos.ferreyra@mail.com",
                        Map.of("street", "San Martín", "number", "870", "neighborhoodId", "BARR-014")
                );
                yield publicarCitizenInfoDelivered(8452L, "M6-REQ-000045", data);
            }
            case "organization-info-delivered" -> {
                OrganizationInfoDeliveredData data = new OrganizationInfoDeliveredData(
                        3311L,
                        30712345678L,
                        "Panadería Del Sol S.R.L.",
                        "Panadería Del Sol",
                        "30712345678",
                        "ACTIVA"
                );
                yield publicarOrganizationInfoDelivered(3311L, "M6-REQ-000046", data);
            }
            case "organization-registered" -> {
                OrganizationRegisteredData data = new OrganizationRegisteredData(
                        3311L,
                        30712345678L,
                        "30712345678",
                        "Panadería Del Sol S.R.L.",
                        "Panadería Del Sol",
                        "COMMERCE",
                        "ACTIVE",
                        Map.of("personId", 8452L, "personType", "LEGAL")
                );
                yield publicarOrganizationRegistered(3311L, data);
            }
            case "representation-granted" -> {
                RepresentationGrantedData data = new RepresentationGrantedData(
                        990L,
                        8452L,
                        3311L,
                        30712345678L,
                        "LEGAL_REPRESENTATIVE",
                        "2026-08-21",
                        "VALID"
                );
                yield publicarRepresentationGranted(990L, data);
            }
            case "representation-expired" -> {
                RepresentationExpiredData data = new RepresentationExpiredData(
                        990L,
                        8452L,
                        3311L,
                        30712345678L,
                        "2026-09-14",
                        "EXPIRED"
                );
                yield publicarRepresentationExpired(990L, data);
            }
            case "social-documentation-delivered" -> {
                Map<String, Object> doc1 = Map.of(
                        "requestId", "sol-doc-3341",
                        "documentType", "INCOME_CERTIFICATE",
                        "status", "PENDING"
                );
                Map<String, Object> doc2 = Map.of(
                        "requestId", "sol-doc-3342",
                        "documentType", "BIRTH_CERTIFICATE",
                        "status", "COMPLETED",
                        "documentId", "doc-77120"
                );
                Map<String, Object> file = Map.of(
                        "fileId", "exp-00981",
                        "number", "EXP-2026-00981",
                        "initiatingArea", "SOCIAL_DEVELOPMENT",
                        "status", "IN_PROGRESS",
                        "documentationRequests", List.of(doc1, doc2)
                );
                SocialDocumentationDeliveredData data = new SocialDocumentationDeliveredData(
                        8452L,
                        "sol-00456",
                        "prog-00789",
                        List.of(file)
                );
                yield publicarSocialDocumentationDelivered("3f7a1c2e-84b0-4d9e-a123-000000000001", data);
            }
            default -> throw new IllegalArgumentException("Ejemplo no reconocido: " + ejemploKey);
        };
    }

    // ------------------------------------------------ Helpers

    private String generarEventId() {
        return "M1-EVT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String fechaActualIso() {
        return OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}

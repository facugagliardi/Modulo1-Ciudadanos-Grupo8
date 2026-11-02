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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Servicio centralizado para la emision de eventos asincronicos.
 * Garantiza la persistencia en la tabla events de PostgreSQL (patron Outbox)
 * y su despacho confirmado mediante un trabajador de outbox.
 */
@Service
@Transactional
public class EventPublisherService {

    private static final Logger log = LoggerFactory.getLogger(EventPublisherService.class);

    private final EventoService eventoService;
    private final EventOutbox outbox;
    private final ObjectMapper objectMapper;
    private final ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository ciudadanoRepository;

    public EventPublisherService(EventoService eventoService, EventOutbox outbox, ObjectMapper objectMapper,
            ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository ciudadanoRepository) {
        this.eventoService = eventoService;
        this.outbox = outbox;
        this.objectMapper = objectMapper;
        this.ciudadanoRepository = ciudadanoRepository;
    }

    /**
     * Publica cualquier EventEnvelope generico:
     * 1. Guarda en PostgreSQL (tabla events) con TipoEvento.EMITIDO.
     * 2. Encola en la misma transaccion; el trabajador envia luego del commit y reintenta fallos.
     */
    @Transactional
    public <T> EventEnvelope<T> publicar(EventEnvelope<T> envelope, String routingKey) {
        try {
            String payloadJson = objectMapper.writeValueAsString(envelope);
            eventoService.registrarEmitido(envelope.eventId(), envelope.sourceModule(), envelope.subject(), envelope.eventType(), payloadJson);
            log.info("Evento persistido localmente: eventId={}, eventType={}", envelope.eventId(), envelope.eventType());
        } catch (Exception ex) {
            log.error("Error al serializar y persistir el evento en PostgreSQL: {}", ex.getMessage(), ex);
            throw new IllegalStateException("No se pudo registrar el evento emitido", ex);
        }

        try {
            outbox.encolar(envelope.eventId(), routingKey, objectMapper.writeValueAsString(envelope));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("No se pudo serializar el outbox", e);
        }

        return envelope;
    }

    public static final String EJEMPLO_CITIZEN_UUID = "b63f5a2e-4b71-46e7-8b01-381c85d88f62";

    /**
     * Resuelve de forma robusta el identificador de un ciudadano al formato UUID.
     * Si ya es un UUID válido, lo retorna tal cual. Si es numérico (ID interno, CUIT o DNI),
     * busca en la base de datos para obtener el UUID canónico asignado al ciudadano.
     */
    public String resolverCitizenUuid(String rawCitizenId) {
        if (rawCitizenId == null || rawCitizenId.isBlank()) {
            return rawCitizenId;
        }
        // 1. Si ya tiene formato UUID válido, devolverlo tal cual
        try {
            return UUID.fromString(rawCitizenId.trim()).toString();
        } catch (IllegalArgumentException ignored) {
        }
        // 2. Si es numérico (ID de BD, CUIT o DNI), buscar en repositorio para obtener su UUID
        if (ciudadanoRepository != null) {
            try {
                String digits = rawCitizenId.trim().replaceAll("[^0-9]", "");
                if (!digits.isEmpty()) {
                    Long idNum = Long.parseLong(digits);
                    var porId = ciudadanoRepository.findById(idNum);
                    if (porId.isPresent() && porId.get().getUuid() != null) {
                        return porId.get().getUuid().toString();
                    }
                    var porCuit = ciudadanoRepository.findByCuit(idNum);
                    if (porCuit.isPresent() && porCuit.get().getUuid() != null) {
                        return porCuit.get().getUuid().toString();
                    }
                    var porDni = ciudadanoRepository.findByDocumentoId(digits);
                    if (porDni.isPresent() && porDni.get().getUuid() != null) {
                        return porDni.get().getUuid().toString();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return rawCitizenId;
    }

    // ------------------------------------------------ Metodos de negocio

    /**
     * 1. citizenUpdated (M1 -> M2 y M5)
     */
    public EventEnvelope<CitizenUpdatedData> publicarCitizenUpdated(String citizenId,
                                                                   String updateType,
                                                                   Map<String, Object> details,
                                                                   UpdatedBy updatedBy) {
        String citizenUuid = resolverCitizenUuid(citizenId);
        String eventId = generarEventId();
        String occuredAt = fechaActualIso();
        CitizenUpdatedData data = new CitizenUpdatedData(citizenUuid, updateType, details, updatedBy);
        EventEnvelope<CitizenUpdatedData> envelope = EventEnvelope.de(
                eventId,
                occuredAt,
                "citizenUpdated",
                EventEnvelope.SOURCE_MODULE_CIUDADANOS,
                data
        );
        return publicar(envelope, "modulo1.citizens." + updateType.toLowerCase());
    }

    public EventEnvelope<CitizenUpdatedData> publicarCitizenUpdated(UUID citizenUuid,
                                                                   String updateType,
                                                                   Map<String, Object> details,
                                                                   UpdatedBy updatedBy) {
        return publicarCitizenUpdated(citizenUuid != null ? citizenUuid.toString() : null, updateType, details, updatedBy);
    }

    public EventEnvelope<CitizenUpdatedData> publicarCitizenUpdated(Long citizenId,
                                                                   String updateType,
                                                                   Map<String, Object> details,
                                                                   UpdatedBy updatedBy) {
        String citizenUuid = citizenId != null ? resolverCitizenUuid(String.valueOf(citizenId)) : null;
        return publicarCitizenUpdated(citizenUuid, updateType, details, updatedBy);
    }

    /**
     * 2. caseFileResolved (M1 -> M3 Obras Publicas)
     */
    public EventEnvelope<CaseFileResolvedData> publicarCaseFileResolved(CaseFileResolvedData data, String correlationId) {
        if (data == null || correlationId == null || !UUID.fromString(correlationId).toString().equalsIgnoreCase(correlationId)) {
            throw new IllegalArgumentException("Resolucion y correlationId UUID son obligatorios");
        }
        var envelope = EventEnvelope.de(generarEventId(), fechaActualIso(), "caseFileResolved",
                EventEnvelope.SOURCE_MODULE_CIUDADANOS, correlationId, data);
        return publicar(envelope, "caseFileResolved");
    }

    /**
     * 3. citizenInfoDelivered (M1 -> M6 Ambiente)
     */
    public EventEnvelope<CitizenInfoDeliveredData> publicarCitizenInfoDelivered(String citizenId,
                                                                               String correlationId,
                                                                               CitizenInfoDeliveredData data) {
        String citizenUuid = resolverCitizenUuid(citizenId);
        CitizenInfoDeliveredData dataConUuid = data;
        if (data != null && (data.citizenId() == null || !data.citizenId().equals(citizenUuid))) {
            dataConUuid = new CitizenInfoDeliveredData(
                    citizenUuid, data.fullName(), data.documentId(), data.phone(), data.email(), data.address()
            );
        }
        String eventId = generarEventId();
        String occuredAt = fechaActualIso();
        EventEnvelope<CitizenInfoDeliveredData> envelope = EventEnvelope.de(
                eventId,
                occuredAt,
                "citizenInfoDelivered",
                EventEnvelope.SOURCE_MODULE_CIUDADANOS,
                correlationId,
                dataConUuid
        );
        return publicar(envelope, "modulo1.citizens.infodelivered");
    }

    public EventEnvelope<CitizenInfoDeliveredData> publicarCitizenInfoDelivered(UUID citizenUuid,
                                                                               String correlationId,
                                                                               CitizenInfoDeliveredData data) {
        return publicarCitizenInfoDelivered(citizenUuid != null ? citizenUuid.toString() : null, correlationId, data);
    }

    public EventEnvelope<CitizenInfoDeliveredData> publicarCitizenInfoDelivered(Long citizenId,
                                                                               String correlationId,
                                                                               CitizenInfoDeliveredData data) {
        String citizenUuid = citizenId != null ? resolverCitizenUuid(String.valueOf(citizenId)) : null;
        return publicarCitizenInfoDelivered(citizenUuid, correlationId, data);
    }

    /**
     * 4. organizationInfoDelivered (M1 -> M6 Ambiente)
     */
    public EventEnvelope<OrganizationInfoDeliveredData> publicarOrganizationInfoDelivered(Long cuit,
                                                                                         String correlationId,
                                                                                         OrganizationInfoDeliveredData data) {
        String eventId = generarEventId();
        String occuredAt = fechaActualIso();
        EventEnvelope<OrganizationInfoDeliveredData> envelope = EventEnvelope.de(
                eventId,
                occuredAt,
                "organizationInfoDelivered",
                EventEnvelope.SOURCE_MODULE_CIUDADANOS,
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
        String occuredAt = fechaActualIso();
        EventEnvelope<OrganizationRegisteredData> envelope = EventEnvelope.de(
                eventId,
                occuredAt,
                "organizationRegistered",
                EventEnvelope.SOURCE_MODULE_CIUDADANOS,
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
        String occuredAt = fechaActualIso();
        EventEnvelope<RepresentationGrantedData> envelope = EventEnvelope.de(
                eventId,
                occuredAt,
                "representationGranted",
                EventEnvelope.SOURCE_MODULE_CIUDADANOS,
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
        String occuredAt = fechaActualIso();
        EventEnvelope<RepresentationExpiredData> envelope = EventEnvelope.de(
                eventId,
                occuredAt,
                "representationExpired",
                EventEnvelope.SOURCE_MODULE_CIUDADANOS,
                data
        );
        return publicar(envelope, "modulo1.representations.expired");
    }

    /**
     * 8. socialDocumentationDelivered (M1 -> M8 Desarrollo Social)
     */
    public EventEnvelope<SocialDocumentationDeliveredData> publicarSocialDocumentationDelivered(String causationId,
                                                                                               String correlationId,
                                                                                               SocialDocumentationDeliveredData data) {
        SocialDocumentationDeliveredData dataConUuid = data;
        if (data != null && data.citizenId() != null) {
            String uuid = resolverCitizenUuid(data.citizenId());
            if (!uuid.equals(data.citizenId())) {
                dataConUuid = new SocialDocumentationDeliveredData(
                        uuid, data.applicationId(), data.programId(), data.files(), data.programEditionId()
                );
            }
        }
        String eventId = generarEventId();
        String occuredAt = fechaActualIso();
        String corrId = (correlationId != null && !correlationId.isBlank()) ? correlationId : UUID.randomUUID().toString();
        EventEnvelope<SocialDocumentationDeliveredData> envelope = EventEnvelope.de(
                eventId,
                occuredAt,
                "socialDocumentationDelivered",
                EventEnvelope.SOURCE_MODULE_CIUDADANOS,
                corrId,
                causationId,
                dataConUuid
        );
        return publicar(envelope, "socialDocumentationDelivered");
    }

    public EventEnvelope<SocialDocumentationDeliveredData> publicarSocialDocumentationDelivered(String causationId,
                                                                                               SocialDocumentationDeliveredData data) {
        return publicarSocialDocumentationDelivered(causationId, null, data);
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
                yield publicarCitizenUpdated(EJEMPLO_CITIZEN_UUID, "REGISTERED", details, UpdatedBy.selfService());
            }
            case "citizen-blocked" -> {
                Map<String, Object> details = Map.of(
                        "reason", "DOCUMENTACION_APOCRIFA",
                        "reviewRequired", true
                );
                yield publicarCitizenUpdated(EJEMPLO_CITIZEN_UUID, "BLOCKED", details, UpdatedBy.areaUser("USR-M1-14"));
            }
            case "citizen-deceased" -> {
                Map<String, Object> details = Map.of(
                        "deceasedAt", "2026-08-19",
                        "source", "REGISTRO_CIVIL"
                );
                yield publicarCitizenUpdated(EJEMPLO_CITIZEN_UUID, "DECEASED", details, UpdatedBy.areaUser("USR-M1-09"));
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
                yield publicarCitizenUpdated(EJEMPLO_CITIZEN_UUID, "ADDRESS_UPDATED", details, UpdatedBy.areaUser("USR-M1-14"));
            }
            case "casefile-resolved" -> {
                CaseFileResolvedData data = new CaseFileResolvedData(
                        UUID.fromString("d40e20ba-e2a8-4dd0-a11f-b6d6b58c68a8"), "EXP-2026-001042", "resolved", "approved",
                        Map.of("type", "PUBLIC_WORKS_PROJECT", "id", "7b745d35-536d-4387-a722-cb690586305d"),
                        "Ejemplo de dictamen administrativo favorable.");
                yield publicarCaseFileResolved(data, UUID.randomUUID().toString());
            }
            case "citizen-info-delivered" -> {
                CitizenInfoDeliveredData data = new CitizenInfoDeliveredData(
                        EJEMPLO_CITIZEN_UUID,
                        "Marcos Ferreyra",
                        "34567890",
                        "+54 11 4455-6677",
                        "marcos.ferreyra@mail.com",
                        Map.of("street", "San Martín", "number", "870", "neighborhoodId", "BARR-014")
                );
                yield publicarCitizenInfoDelivered(EJEMPLO_CITIZEN_UUID, "M6-REQ-000045", data);
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
                        EJEMPLO_CITIZEN_UUID,
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
        return UUID.randomUUID().toString();
    }

    private String fechaActualIso() {
        return OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}

package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import ar.edu.uade.ciudadanos.security.TipoSujeto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Proyecciones publicas de M2/M5. No resuelve sus tramites ni crea expedientes. */
@Service
public class TramitesExternosService {
    public static final Set<String> EVENTOS = Set.of("ticketCreated", "ticketUpdated", "updateTicketStatus",
            "exemptionRequested", "updateExemptionStatus", "paymentPlanRequested", "updatePaymentPlanStatus");
    private static final Set<String> ESTADOS_TICKET = Set.of("REGISTERED", "IN_REVIEW", "ROUTED", "IN_PROGRESS",
            "PENDING_INFORMATION", "DUPLICATE", "RESOLVED", "CLOSED", "CANCELLED");
    private static final Set<String> CAMBIOS_TICKET = Set.of("STATUS_CHANGED", "ROUTED", "PROGRESS",
            "PRIORITY_CHANGED", "ESCALATION_CHANGED", "INFORMATION_REQUIRED", "INFORMATION_PROVIDED",
            "DUPLICATE_LINKED", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED", "CONTENT_UPDATED");
    private static final Map<String, String> ESTADOS_OPERATIVOS = Map.of("STARTED", "IN_PROGRESS",
            "PROGRESS", "IN_PROGRESS", "INFORMATION_REQUIRED", "PENDING_INFORMATION", "RETURNED", "IN_REVIEW",
            "RESOLVED", "RESOLVED", "REJECTED", "CANCELLED");
    private static final Map<String, String> AREAS = Map.of("ciudadanos", "M1", "atencion-ciudadana", "M2",
            "obras", "M3", "habilitaciones", "M4", "rentas", "M5", "ambiente", "M6",
            "transito", "M7", "desarrollo-social", "M8");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final CiudadanoRepository ciudadanos;
    private final AutorizacionService permisos;

    public TramitesExternosService(JdbcTemplate jdbc, ObjectMapper mapper, CiudadanoRepository ciudadanos,
                                  AutorizacionService permisos) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.ciudadanos = ciudadanos;
        this.permisos = permisos;
    }

    public record Tramite(String sourceModule, String tipo, String externalId, Long ciudadanoId,
                          String estado, OffsetDateTime actualizadoEn, JsonNode datos) { }

    @Transactional(readOnly = true)
    public List<Tramite> listar(Long ciudadanoId) {
        // Los IDs de empleado y ciudadano pertenecen a espacios diferentes.
        boolean propio = permisos.actual().tipoInfo() == TipoSujeto.CIUDADANO
                && permisos.actual().id().equals(ciudadanoId);
        if (!propio) permisos.exigir(Permiso.LEER_TERCEROS, "consultar tramites externos de otro ciudadano");
        if (!ciudadanos.existsById(ciudadanoId)) throw ApiException.noEncontrado("No existe el ciudadano");
        return jdbc.query("SELECT * FROM tramite_externo WHERE ciudadano_id = ? ORDER BY actualizado_en DESC",
                (rs, n) -> new Tramite(rs.getString("source_module"), rs.getString("tipo"), rs.getString("external_id"),
                        rs.getLong("ciudadano_id"), rs.getString("estado"), rs.getObject("actualizado_en", OffsetDateTime.class),
                        json(rs.getString("datos_publicos"))), ciudadanoId);
    }

    /** Registro de recepcion y proyeccion comparten transaccion; un fallo permite reintentar el mismo eventId. */
    @Transactional
    public String procesar(JsonNode envelope) {
        String eventType = texto(envelope, "eventType");
        if (!EVENTOS.contains(eventType)) return "IGNORADO";
        validarSobre(envelope);
        String eventId = uuid(texto(envelope, "eventId"), "eventId");
        String source = texto(envelope, "sourceModule");
        JsonNode data = envelope.path("data");
        if (!data.isObject()) throw ApiException.invalido("data debe ser un objeto");
        boolean ticket = eventType.contains("Ticket") || eventType.startsWith("ticket");
        boolean operativo = eventType.equals("updateTicketStatus");
        if (ticket && !operativo && !source.equals("atencion-ciudadana")) {
            throw ApiException.invalido("Los snapshots de tickets deben provenir de atencion-ciudadana");
        }
        if (!ticket && !source.equals("rentas")) throw ApiException.invalido("El evento debe provenir de rentas");
        if (operativo && (!AREAS.containsKey(source) || source.equals("atencion-ciudadana"))) {
            throw ApiException.invalido("Origen operativo de ticket invalido");
        }
        if (ticket && !operativo) {
            if (!data.path("isAnonymous").isBoolean()) throw ApiException.invalido("isAnonymous es obligatorio");
            if (data.path("isAnonymous").asBoolean()) return "IGNORADO_ANONIMO";
        }
        String tipo = ticket ? "TICKET" : eventType.toLowerCase().contains("exemption") ? "EXENCION" : "PLAN_PAGO";
        String externalId = texto(data, ticket ? "ticketId" : "requestId");
        if (ticket) externalId = uuid(externalId, "ticketId");
        if (externalId.length() > 100) throw ApiException.invalido("Identificador externo demasiado largo");
        String owner = ticket ? "atencion-ciudadana" : "rentas";
        OffsetDateTime fecha = fecha(envelope, data, eventType);
        // Serializa incluso la primera insercion por tramite, que aun no tiene una fila para FOR UPDATE.
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
                (rs, n) -> 0, owner + ":" + tipo + ":" + externalId);
        List<Tramite> previos = jdbc.query("SELECT * FROM tramite_externo WHERE source_module=? AND tipo=? AND external_id=?",
                (rs, n) -> new Tramite(owner, tipo, rs.getString("external_id"), rs.getLong("ciudadano_id"),
                        rs.getString("estado"), rs.getObject("actualizado_en", OffsetDateTime.class), json(rs.getString("datos_publicos"))),
                owner, tipo, externalId);
        Tramite previo = previos.isEmpty() ? null : previos.getFirst();
        // M2 v1.78: nunca crear un ticket a partir de un hecho operativo que no conocemos.
        if (operativo && previo == null) return "IGNORADO_DESCONOCIDO";
        if (operativo && !AREAS.get(source).equals(previo.datos().path("responsibleAreaId").asText())) {
            return "IGNORADO_OTRA_AREA";
        }
        Long ciudadanoId = operativo ? previo.ciudadanoId() : ciudadanos
                .findByUuid(UUID.fromString(uuid(texto(data, "citizenId"), "citizenId")))
                .orElseThrow(() -> ApiException.noEncontrado("citizenId no corresponde a un ciudadano de M1"))
                .getId();
        if (previo != null && !previo.ciudadanoId().equals(ciudadanoId)) {
            throw ApiException.conflicto("El tramite externo ya pertenece a otro ciudadano");
        }
        String estado = estado(data, eventType);
        ObjectNode publico = publico(data, ticket, operativo);
        ObjectNode seguro = mapper.createObjectNode();
        seguro.put("eventId", eventId).put("eventType", eventType).put("sourceModule", source);
        seguro.put("occurredAt", fecha.toString());
        seguro.set("data", publico);
        int insertados = jdbc.update("""
                INSERT INTO events(event_id, aggregate_type, aggregate_id, event_type, payload, type)
                VALUES (?, ?, ?, ?, ?, 'RECIBIDO') ON CONFLICT (event_id) DO NOTHING
                """, eventId, tipo, externalId, eventType, seguro.toString());
        if (insertados == 0) return "DUPLICADO";
        ObjectNode fusionado = previo == null ? mapper.createObjectNode() : ((ObjectNode) previo.datos()).deepCopy();
        if (previo != null && !fecha.toInstant().isAfter(previo.actualizadoEn().toInstant())) {
            // Un alta retrasada completa el snapshot base, sin retroceder el estado mas nuevo.
            if (eventType.equals("ticketCreated")) {
                publico.fields().forEachRemaining(e -> { if (!fusionado.has(e.getKey())) fusionado.set(e.getKey(), e.getValue()); });
                jdbc.update("UPDATE tramite_externo SET datos_publicos=? WHERE source_module=? AND tipo=? AND external_id=?",
                        fusionado.toString(), owner, tipo, externalId);
            }
            return "IGNORADO_ANTIGUO";
        }
        if (!ticket) {
            // Al pasar de otorgado a rechazado no conservar identificadores o condiciones del otorgamiento.
            for (String campo : List.of("exemptionId", "percentage", "validFrom", "validUntil", "planId", "totalAmount", "reason")) {
                fusionado.remove(campo);
            }
        }
        fusionado.setAll(publico);
        jdbc.update("""
                INSERT INTO tramite_externo(source_module,tipo,external_id,ciudadano_id,estado,actualizado_en,datos_publicos)
                VALUES (?,?,?,?,?,?,?) ON CONFLICT (source_module,tipo,external_id) DO UPDATE SET
                estado=EXCLUDED.estado, actualizado_en=EXCLUDED.actualizado_en, datos_publicos=EXCLUDED.datos_publicos
                """, owner, tipo, externalId, ciudadanoId, estado, fecha, fusionado.toString());
        return "APLICADO";
    }

    private String estado(JsonNode data, String evento) {
        if (evento.equals("ticketCreated")) {
            texto(data, "publicId");
            if (!texto(data, "status").equals("REGISTERED")) throw ApiException.invalido("ticketCreated requiere REGISTERED");
            return "REGISTERED";
        }
        if (evento.equals("ticketUpdated")) {
            texto(data, "publicId");
            if (!CAMBIOS_TICKET.contains(texto(data, "updateType"))) throw ApiException.invalido("updateType de M2 invalido");
            String estado = texto(data, "currentStatus");
            if (!ESTADOS_TICKET.contains(estado)) throw ApiException.invalido("currentStatus de M2 invalido");
            return estado;
        }
        if (evento.equals("updateTicketStatus")) {
            String estado = ESTADOS_OPERATIVOS.get(texto(data, "updateType"));
            if (estado == null) throw ApiException.invalido("updateType operativo invalido");
            return estado;
        }
        if (evento.endsWith("Requested")) return "REQUESTED";
        String estado = texto(data, "status");
        Set<String> permitidos = evento.equals("updateExemptionStatus") ? Set.of("APPROVED", "REJECTED") : Set.of("GRANTED", "REJECTED");
        if (!permitidos.contains(estado)) throw ApiException.invalido("status de Rentas invalido");
        if (estado.equals("REJECTED")) texto(data, "reason");
        return estado;
    }

    private void validarSobre(JsonNode envelope) {
        Set<String> campos = Set.of("eventId", "eventType", "eventVersion", "occurredAt", "occuredAt",
                "sourceModule", "correlationId", "causationId", "data", "receivedAt");
        envelope.fieldNames().forEachRemaining(campo -> {
            if (!campos.contains(campo)) throw ApiException.invalido("Campo de envelope no permitido: " + campo);
        });
        UUID id = UUID.fromString(uuid(texto(envelope, "eventId"), "eventId"));
        if (id.version() != 4) throw ApiException.invalido("eventId debe ser UUIDv4");
        if (texto(envelope, "sourceModule").length() > 60) throw ApiException.invalido("sourceModule demasiado largo");
        if (envelope.hasNonNull("eventVersion") && !envelope.path("eventVersion").asText().equals("1.0")) {
            throw ApiException.invalido("eventVersion no soportada; se admite 1.0");
        }
        for (String campo : List.of("correlationId", "causationId")) {
            if (envelope.hasNonNull(campo)) uuid(texto(envelope, campo), campo);
        }
        String valor = envelope.has("occurredAt") ? texto(envelope, "occurredAt") : texto(envelope, "occuredAt");
        try {
            OffsetDateTime fecha = OffsetDateTime.parse(valor);
            if (envelope.has("occurredAt") && envelope.has("occuredAt")
                    && !fecha.toInstant().equals(OffsetDateTime.parse(texto(envelope, "occuredAt")).toInstant())) {
                throw ApiException.invalido("Las dos grafias de occurredAt no pueden tener fechas distintas");
            }
        } catch (java.time.format.DateTimeParseException e) {
            throw ApiException.invalido("occurredAt requiere ISO-8601 con offset");
        }
    }

    /** Lista blanca: ni internalMessage ni tracking codes ni actores privados se guardan o devuelven. */
    private ObjectNode publico(JsonNode data, boolean ticket, boolean operativo) {
        ObjectNode out = mapper.createObjectNode();
        List<String> campos = operativo ? List.of("ticketId", "progress", "publicMessage", "attachments", "updateType")
                : ticket ? List.of("ticketId", "publicId", "citizenId", "requestType", "category", "subcategory",
                "ticketType", "summary", "description", "formData", "priority", "currentPriority", "responsibleAreaId",
                "location", "resolutionDueAt", "progress", "publicMessage", "attachments", "updateType")
                : List.of("requestId", "citizenId", "conceptCode", "reason", "requestedPercentage", "requestedFrom",
                "requestedUntil", "exemptionId", "percentage", "validFrom", "validUntil", "debtIds", "totalDebt",
                "installments", "planId", "totalAmount");
        for (String campo : campos) if (data.has(campo)) out.set(campo, data.get(campo));
        if (ticket) {
            String variante = data.path("updateType").asText();
            if (variante.equals("ROUTED") || variante.equals("CONTENT_UPDATED")) {
                JsonNode snapshot = data.path("details").path(variante.equals("ROUTED") ? "routing" : "content");
                for (String campo : List.of("requestType", "category", "subcategory", "ticketType", "summary", "description",
                        "formData", "location", "resolutionDueAt", "escalation")) {
                    if (snapshot.has(campo)) out.set(campo, snapshot.get(campo));
                }
            }
            if (variante.equals("INFORMATION_REQUIRED")) {
                out.put("publicMessage", texto(data.path("details").path("informationRequest"), "messageForCitizen"));
                JsonNode limite = data.path("details").path("informationRequest").get("requiredBy");
                if (limite != null) out.set("informationRequiredBy", limite);
            }
            if (variante.equals("INFORMATION_PROVIDED")) {
                JsonNode mensaje = data.path("details").path("informationResponse").get("message");
                if (mensaje != null) out.set("informationResponse", mensaje);
            }
            if (operativo) {
                // La identidad/titularidad nunca se toma de un hecho operativo.
                out.remove(List.of("citizenId", "publicId", "responsibleAreaId"));
            }
        }
        if (!ticket && data.path("status").asText().equals("REJECTED")) {
            out.remove(List.of("exemptionId", "percentage", "validFrom", "validUntil", "planId", "totalAmount", "installments"));
        }
        return out;
    }

    private OffsetDateTime fecha(JsonNode envelope, JsonNode data, String evento) {
        String campo = switch (evento) {
            case "ticketCreated" -> "createdAt";
            case "ticketUpdated" -> "updatedAt";
            case "updateTicketStatus" -> "updateOccurredAt";
            default -> null;
        };
        String valor = campo == null ? envelope.path("occurredAt").asText(envelope.path("occuredAt").asText()) : texto(data, campo);
        try { return OffsetDateTime.parse(valor); }
        catch (RuntimeException e) { throw ApiException.invalido("Fecha invalida: requiere ISO-8601 con offset"); }
    }

    private String texto(JsonNode node, String campo) {
        JsonNode valor = node.get(campo);
        if (valor == null || !valor.isTextual() || valor.asText().isBlank()) throw ApiException.invalido(campo + " es obligatorio");
        return valor.asText();
    }

    private String uuid(String valor, String campo) {
        try {
            UUID id = UUID.fromString(valor);
            if (!id.toString().equalsIgnoreCase(valor)) throw new IllegalArgumentException();
            return id.toString();
        } catch (IllegalArgumentException e) { throw ApiException.invalido(campo + " debe ser UUID canonico"); }
    }

    private JsonNode json(String valor) {
        try { return mapper.readTree(valor); }
        catch (java.io.IOException e) { throw new IllegalStateException("Proyeccion ilegible", e); }
    }
}

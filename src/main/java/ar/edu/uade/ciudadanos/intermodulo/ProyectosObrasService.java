package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.evento.EventoService;
import ar.edu.uade.ciudadanos.expediente.entity.Expediente;
import ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** M3 v0.7: una obra tiene un expediente; su ciclo no resuelve el tramite administrativo. */
@Service
public class ProyectosObrasService {
    public static final Set<String> EVENTOS = Set.of("publicWorksProjectApproved", "publicWorksProjectCompleted");
    private final JdbcTemplate jdbc;
    private final ExpedienteRepository expedientes;
    private final CiudadanoRepository ciudadanos;
    private final EventoService eventos;

    public ProyectosObrasService(JdbcTemplate jdbc, ExpedienteRepository expedientes,
            CiudadanoRepository ciudadanos, EventoService eventos) {
        this.jdbc = jdbc;
        this.expedientes = expedientes;
        this.ciudadanos = ciudadanos;
        this.eventos = eventos;
    }

    private record Proyecto(Long expedienteId, OffsetDateTime approvedAt, OffsetDateTime completedAt) { }

    @Transactional
    public String procesar(JsonNode envelope) {
        String tipo = texto(envelope, "eventType", 120);
        if (!EVENTOS.contains(tipo)) return "IGNORADO";
        validarSobre(envelope);
        boolean aprobado = tipo.equals("publicWorksProjectApproved");
        JsonNode data = envelope.path("data");
        validarDatos(data, aprobado);
        UUID projectId = uuid(data, "publicWorksProjectId");
        UUID eventId = uuid(envelope, "eventId");
        OffsetDateTime fecha = fecha(data, aprobado ? "approvedAt" : "completedAt");
        Long titularId = data.has("citizenId") ? ciudadanos.findByUuid(uuid(data, "citizenId"))
                .orElseThrow(() -> ApiException.noEncontrado("citizenId no existe en M1")).getId() : null;

        // Protege tambien la primera insercion, cuando no existe una fila para FOR UPDATE.
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?,0))", (rs, n) -> 0, "M3:" + projectId);
        if (eventos.estaProcesado(eventId.toString())) return "DUPLICADO";
        List<Proyecto> previos = jdbc.query("SELECT * FROM proyecto_obra_externo WHERE project_id=?",
                (rs, n) -> new Proyecto(rs.getObject("expediente_id", Long.class),
                        rs.getObject("approved_at", OffsetDateTime.class), rs.getObject("completed_at", OffsetDateTime.class)), projectId);
        Proyecto previo = previos.isEmpty() ? null : previos.getFirst();
        Expediente expediente = previo == null || previo.expedienteId() == null ? null
                : expedientes.findById(previo.expedienteId()).orElseThrow(() -> new IllegalStateException("Vinculo M3 roto"));
        // Nunca asociar un UUID ajeno enviado por M3 con otro expediente.
        if (data.has("caseFileId") && (expediente == null || !expediente.getUuid().equals(uuid(data, "caseFileId")))) {
            throw ApiException.conflicto("caseFileId no coincide con el expediente del proyecto");
        }
        OffsetDateTime ultima = previo == null ? null : aprobado ? previo.approvedAt() : previo.completedAt();
        if (ultima != null && !fecha.toInstant().isAfter(ultima.toInstant())) {
            registrar(eventId, projectId, tipo, envelope);
            return "IGNORADO_ANTIGUO";
        }
        if (aprobado && expediente != null && !Objects.equals(expediente.getCiudadanoId(), titularId)) {
            throw ApiException.conflicto("Un evento M3 no puede cambiar el titular del expediente");
        }
        if (!registrar(eventId, projectId, tipo, envelope)) return "DUPLICADO";
        if (previo == null) jdbc.update("INSERT INTO proyecto_obra_externo(project_id) VALUES (?)", projectId);
        if (aprobado) {
            if (expediente == null) {
                expediente = new Expediente();
                expediente.setNumero("EXP-M3-" + projectId);
                expediente.setCiudadanoId(titularId);
                expediente.setAreaIniciadora("Obras Públicas");
                expediente.setCaratula(texto(data, "name", 200));
                expediente.setPublicWorksProjectId(projectId);
                expediente.setEstadoObra(previo != null && previo.completedAt() != null ? "COMPLETED" : "APPROVED");
                expediente.setFechaInicio(fecha);
                expediente = expedientes.saveAndFlush(expediente);
            }
            jdbc.update("""
                    UPDATE proyecto_obra_externo SET expediente_id=?,approved_at=?,approval_data=?,correlation_id=?
                    WHERE project_id=?
                    """, expediente.getExpedienteId(), fecha, data.toString(), uuid(envelope, "correlationId"), projectId);
        } else {
            // Un completado adelantado queda almacenado hasta que llegue el alta con el titular opcional.
            jdbc.update("UPDATE proyecto_obra_externo SET completed_at=?,completion_data=? WHERE project_id=?",
                    fecha, data.toString(), projectId);
            if (expediente != null) expediente.setEstadoObra("COMPLETED");
        }
        return "APLICADO";
    }

    private boolean registrar(UUID eventId, UUID projectId, String tipo, JsonNode envelope) {
        return eventos.registrarRecibido(eventId.toString(), "PUBLIC_WORKS_PROJECT", projectId.toString(), tipo, envelope.toString());
    }

    private void validarSobre(JsonNode e) {
        campos(e, Set.of("eventId", "eventType", "eventVersion", "occurredAt", "sourceModule", "correlationId", "causationId", "data"));
        uuid(e, "eventId"); uuid(e, "correlationId"); fecha(e, "occurredAt");
        if (e.has("causationId")) uuid(e, "causationId");
        if (!"obras".equals(texto(e, "sourceModule", 60)) || !"1.0".equals(texto(e, "eventVersion", 20))) {
            throw ApiException.invalido("El evento requiere sourceModule obras y eventVersion 1.0");
        }
    }

    private void validarDatos(JsonNode data, boolean aprobado) {
        campos(data, aprobado ? Set.of("publicWorksProjectId", "projectNumber", "name", "approvedAt", "approvedBudget", "citizenId")
                : Set.of("publicWorksProjectId", "projectNumber", "completedAt", "finalBudget", "caseFileId"));
        uuid(data, "publicWorksProjectId"); texto(data, "projectNumber", 80);
        fecha(data, aprobado ? "approvedAt" : "completedAt");
        if (aprobado) texto(data, "name", 200);
        String presupuesto = aprobado ? "approvedBudget" : "finalBudget";
        if (data.has(presupuesto) && (!data.path(presupuesto).isNumber() || data.path(presupuesto).decimalValue().signum() < 0)) {
            throw ApiException.invalido(presupuesto + " debe ser un importe no negativo");
        }
        for (String key : List.of("citizenId", "caseFileId")) if (data.has(key)) uuid(data, key);
    }

    private void campos(JsonNode node, Set<String> permitidos) {
        if (node == null || !node.isObject()) throw ApiException.invalido("Sobre y data deben ser objetos");
        node.fieldNames().forEachRemaining(k -> { if (!permitidos.contains(k)) throw ApiException.invalido("Campo no permitido: " + k); });
    }

    private String texto(JsonNode node, String key, int max) {
        JsonNode value = node.get(key);
        if (value == null || !value.isTextual() || value.asText().isBlank() || value.asText().length() > max) {
            throw ApiException.invalido(key + " es obligatorio o excede su longitud");
        }
        return value.asText();
    }

    private UUID uuid(JsonNode node, String key) {
        String value = texto(node, key, 36);
        try {
            UUID id = UUID.fromString(value);
            if (!id.toString().equalsIgnoreCase(value)) throw new IllegalArgumentException();
            return id;
        } catch (IllegalArgumentException ex) { throw ApiException.invalido(key + " debe ser UUID canonico"); }
    }

    private OffsetDateTime fecha(JsonNode node, String key) {
        try { return OffsetDateTime.parse(texto(node, key, 50)); }
        catch (java.time.format.DateTimeParseException ex) { throw ApiException.invalido(key + " requiere fecha con offset"); }
    }
}

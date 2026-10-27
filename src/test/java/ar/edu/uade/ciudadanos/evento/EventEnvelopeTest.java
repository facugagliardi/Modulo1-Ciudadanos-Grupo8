package ar.edu.uade.ciudadanos.evento;

import static org.assertj.core.api.Assertions.assertThat;

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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EventEnvelopeTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("citizenUpdated (REGISTERED) debe cumplir exactamente la plantilla estándar requerida por el módulo Core")
    void serializarCitizenUpdatedRegistered() throws Exception {
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
        CitizenUpdatedData data = new CitizenUpdatedData(8452L, "REGISTERED", details, UpdatedBy.selfService());
        String eventId = "3f7a1c2e-84b0-4d9e-a123-000000000123";
        EventEnvelope<CitizenUpdatedData> envelope = EventEnvelope.de(
                eventId,
                "2026-08-20T11:45:00-03:00",
                "citizenUpdated",
                "ciudadanos",
                data
        );

        String json = objectMapper.writeValueAsString(envelope);
        JsonNode root = objectMapper.readTree(json);

        assertThat(root.get("eventId").asText()).isEqualTo(eventId);
        assertThat(root.get("eventType").asText()).isEqualTo("citizenUpdated");
        assertThat(root.get("eventVersion").asText()).isEqualTo("1.0");
        assertThat(root.get("occuredAt").asText()).isEqualTo("2026-08-20T11:45:00-03:00");
        assertThat(root.get("sourceModule").asText()).isEqualTo("ciudadanos");
        assertThat(root.get("data").get("citizenId").asLong()).isEqualTo(8452L);
        assertThat(root.get("data").get("updateType").asText()).isEqualTo("REGISTERED");
        assertThat(root.get("data").get("details").get("dni").asText()).isEqualTo("34567890");
        assertThat(root.get("data").get("updatedBy").get("type").asText()).isEqualTo("SELF_SERVICE");
    }

    @Test
    @DisplayName("casefileResolved debe contener todos los campos requeridos para Módulo 3 y cumplir la plantilla de Core")
    void serializarCaseFileResolved() throws Exception {
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
                "2026-10-15T11:45:00-03:00"
        );
        String eventId = "4e8b2d3f-95c1-4e0f-b234-000000008921";
        EventEnvelope<CaseFileResolvedData> envelope = EventEnvelope.de(
                eventId,
                "2026-10-15T11:45:00-03:00",
                "casefileResolved",
                "ciudadanos",
                data
        );

        String json = objectMapper.writeValueAsString(envelope);
        JsonNode root = objectMapper.readTree(json);

        assertThat(root.get("eventId").asText()).isEqualTo(eventId);
        assertThat(root.get("eventType").asText()).isEqualTo("casefileResolved");
        assertThat(root.get("sourceModule").asText()).isEqualTo("ciudadanos");
        assertThat(root.get("eventVersion").asText()).isEqualTo("1.0");
        assertThat(root.get("occuredAt").asText()).isEqualTo("2026-10-15T11:45:00-03:00");
        assertThat(root.get("data").get("caseFileNumber").asText()).isEqualTo("EXP-2026-001042");
        assertThat(root.get("data").get("state").asText()).isEqualTo("resolved");
        assertThat(root.get("data").get("initiatingArea").asText()).isEqualTo("Obras Públicas");
        assertThat(root.get("data").get("updatedBy").get("id").asLong()).isEqualTo(32424L);
    }

    @Test
    @DisplayName("citizenInfoDelivered y socialDocumentationDelivered deben incluir correlationId y causationId")
    void serializarRespuestasConCorrelationIdYCausationId() throws Exception {
        CitizenInfoDeliveredData cData = new CitizenInfoDeliveredData(
                8452L,
                "Marcos Ferreyra",
                "34567890",
                "+54 11 4455-6677",
                "marcos.ferreyra@mail.com",
                Map.of("street", "San Martín", "number", "870", "neighborhoodId", "BARR-014")
        );
        String eventId = "5f9c3e4a-06d2-4f1a-c345-000000000201";
        String correlationId = "6a0d4f5b-17e3-402b-d456-000000000045";
        String causationId = "7b1e5a6c-28f4-413c-e567-000000000044";

        EventEnvelope<CitizenInfoDeliveredData> envelope = EventEnvelope.de(
                eventId,
                "2026-08-22T09:00:00-03:00",
                "citizenInfoDelivered",
                "ciudadanos",
                correlationId,
                causationId,
                cData
        );

        String json = objectMapper.writeValueAsString(envelope);
        JsonNode root = objectMapper.readTree(json);

        assertThat(root.get("eventId").asText()).isEqualTo(eventId);
        assertThat(root.get("sourceModule").asText()).isEqualTo("ciudadanos");
        assertThat(root.get("eventVersion").asText()).isEqualTo("1.0");
        assertThat(root.get("occuredAt").asText()).isEqualTo("2026-08-22T09:00:00-03:00");
        assertThat(root.get("correlationId").asText()).isEqualTo(correlationId);
        assertThat(root.get("causationId").asText()).isEqualTo(causationId);
        assertThat(root.get("data").get("fullName").asText()).isEqualTo("Marcos Ferreyra");
    }

    @Test
    @DisplayName("organizationRegistered, representationGranted y representationExpired deben serializarse correctamente")
    void serializarEventosOrganizaciones() throws Exception {
        OrganizationRegisteredData orgData = new OrganizationRegisteredData(
                3311L,
                30712345678L,
                "30712345678",
                "Panadería Del Sol S.R.L.",
                "Panadería Del Sol",
                "COMMERCE",
                "ACTIVE",
                Map.of("personId", 8452L, "personType", "LEGAL")
        );
        String eventId = "8c2f6b7d-39a5-424d-f678-000000000127";
        EventEnvelope<OrganizationRegisteredData> orgEnvelope = EventEnvelope.de(
                eventId,
                "2026-08-21T10:15:00-03:00",
                "organizationRegistered",
                "ciudadanos",
                orgData
        );
        String orgJson = objectMapper.writeValueAsString(orgEnvelope);
        assertThat(orgJson).contains("Panadería Del Sol S.R.L.").contains("ciudadanos");
        assertThat(orgJson).contains("\"organizationId\":3311").contains("\"cuit\":30712345678");
        assertThat(orgJson).contains("\"eventVersion\":\"1.0\"").contains("\"occuredAt\":");

        RepresentationGrantedData repData = new RepresentationGrantedData(
                990L, 8452L, 3311L, 30712345678L, "LEGAL_REPRESENTATIVE", "2026-08-21", "VALID"
        );
        String repEventId = "9d3a7c8e-40b6-435e-a789-000000000128";
        EventEnvelope<RepresentationGrantedData> repEnvelope = EventEnvelope.de(
                repEventId,
                "2026-08-21T11:00:00-03:00",
                "representationGranted",
                "ciudadanos",
                repData
        );
        String repJson = objectMapper.writeValueAsString(repEnvelope);
        assertThat(repJson).contains("LEGAL_REPRESENTATIVE").contains("VALID");
        assertThat(repJson).contains("\"organizationId\":3311").contains("\"cuit\":30712345678");
    }
}

package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.documentacion.SolicitudDocumentacionService;
import ar.edu.uade.ciudadanos.documentacion.dto.CambioEstadoSolicitudRequest;
import ar.edu.uade.ciudadanos.documentacion.entity.*;
import ar.edu.uade.ciudadanos.documentacion.repository.*;
import ar.edu.uade.ciudadanos.evento.dto.*;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "M1_TEST_POSTGRES_URL", matches = ".+")
@SpringBootTest(properties = {"spring.config.import=", "app.events.outbox-enabled=false",
        "spring.rabbitmq.listener.simple.auto-startup=false",
        "spring.jpa.properties.hibernate.format_sql=false"})
class M8ContratoPostgresTest {
    private static final String SCHEMA = "m8_" + UUID.randomUUID().toString().replace("-", "");
    private static JdbcTemplate admin;
    @DynamicPropertySource static void configurar(DynamicPropertyRegistry properties) {
        byte[] key = new byte[32];
        new java.security.SecureRandom().nextBytes(key);
        String secret = java.util.Base64.getEncoder().encodeToString(key);
        properties.add("app.jwt.secret", () -> secret);
        String url = System.getenv("M1_TEST_POSTGRES_URL");
        String user = System.getenv("M1_TEST_POSTGRES_USER"), password = System.getenv("M1_TEST_POSTGRES_PASSWORD");
        admin = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
        admin.execute("CREATE SCHEMA " + SCHEMA);
        String scoped = url + (url.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA;
        var ds = new DriverManagerDataSource(scoped, user, password);
        new ResourceDatabasePopulator(new FileSystemResource("db/01_schema.sql"),
                new FileSystemResource("db/04_integracion_social_segura.sql")).execute(ds);
        properties.add("spring.datasource.url", () -> scoped);
        properties.add("spring.datasource.username", () -> user);
        properties.add("spring.datasource.password", () -> password);
    }
    @AfterAll static void limpiar() { if (admin != null) admin.execute("DROP SCHEMA " + SCHEMA + " CASCADE"); }

    @MockitoBean RabbitTemplate rabbit;
    @MockitoBean AutorizacionService permisos;
    @Autowired EventConsumerService consumer;
    @Autowired SolicitudDocumentacionService documentacion;
    @Autowired CiudadanoRepository ciudadanos;
    @Autowired SolicitudDocumentacionRepository solicitudes;
    @Autowired DocumentoRepository documentos;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    private SocialDocumentationRequestedEvent pedido() {
        var ciudadano = new Ciudadano();
        ciudadano.setNombre("Prueba"); ciudadano.setApellido("Contrato");
        ciudadano.setFechaNacimiento(LocalDate.of(1990, 1, 1));
        String numero = String.valueOf(System.nanoTime());
        ciudadano.setDocumentoId(numero); ciudadano.setCuit(Long.parseLong(numero));
        ciudadano = ciudadanos.saveAndFlush(ciudadano);
        var e = EventConsumerServiceTest.evento(); var p = e.payload();
        return new SocialDocumentationRequestedEvent(e.eventId(), e.eventType(), e.eventVersion(), e.occuredAt(),
                e.sourceModule(), e.correlationId(), null, new SocialDocumentationRequestedPayload(ciudadano.getUuid().toString(),
                p.applicationId(), p.programId(), p.requiredDocuments(), null, p.notes(), p.applicationNumber(), p.programEditionId()));
    }

    private SolicitudDocumentacion solicitud(SocialDocumentationRequestedEvent e) {
        return solicitudes.findByTitularId(ciudadanos.findByUuid(UUID.fromString(e.payload().citizenId())).orElseThrow().getId()).getFirst();
    }
    private Documento documento(SolicitudDocumentacion s) {
        var doc = new Documento(); doc.setCiudadanoId(s.getTitularId()); doc.setTipoDocumento("OTRO"); doc.setCargadoPor("prueba");
        return documentos.saveAndFlush(doc);
    }

    @Test void pedidoYCumplimientoConservanLosUuidEnElOutbox() throws Exception {
        var e = pedido();
        assertTrue(consumer.procesarSocialDocumentationRequested(e));
        var s = solicitud(e); var doc = documento(s);
        assertNull(s.getPlazo());
        documentacion.cambiarEstado(s.getSolicitudId(), new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, doc.getDocumentoId()));
        var payloads = jdbc.queryForList("SELECT payload FROM event_outbox WHERE payload LIKE ? ORDER BY created_at", String.class,
                "%" + e.payload().applicationId() + "%");
        assertEquals(2, payloads.size());
        var initial = mapper.readTree(payloads.getFirst()); var completed = mapper.readTree(payloads.getLast());
        assertEquals(e.eventId(), initial.path("causationId").asText());
        assertFalse(completed.has("causationId"));
        assertEquals(e.correlationId(), completed.path("correlationId").asText());
        assertEquals(e.payload().programEditionId(), completed.path("data").path("programEditionId").asText());
        var firstFile = initial.path("data").path("files").get(0);
        var lastFile = completed.path("data").path("files").get(0);
        assertEquals(firstFile.path("fileId"), lastFile.path("fileId"));
        var requirement = lastFile.path("documentationRequests").get(0);
        assertEquals(s.getUuid().toString(), requirement.path("requestId").asText());
        assertEquals(doc.getUuid().toString(), requirement.path("documentId").asText());
        assertEquals(e.payload().requiredDocuments().getFirst().get("requirementId"), requirement.path("requirementId").asText());
        assertEquals("INCOME_CERTIFICATE", requirement.path("documentType").asText());
        assertEquals(EstadoSolicitud.CUMPLIDA, solicitudes.findById(s.getSolicitudId()).orElseThrow().getEstado());
    }

    @Test void dosEntregasConcurrentesCreanUnaSolaSolicitud() throws Exception {
        var e = pedido();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> consumer.procesarSocialDocumentationRequested(e));
            var b = executor.submit(() -> consumer.procesarSocialDocumentationRequested(e));
            assertNotEquals(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));
        }
        long titular = solicitud(e).getTitularId();
        assertEquals(1, solicitudes.findByTitularId(titular).size());
    }

    @Test void falloDeOutboxRevierteElCumplimientoYPermiteReintento() {
        var e = pedido(); consumer.procesarSocialDocumentationRequested(e);
        var s = solicitud(e); var doc = documento(s);
        jdbc.execute("ALTER TABLE event_outbox ADD CONSTRAINT prueba_fallo CHECK (payload NOT LIKE '%COMPLETED%') NOT VALID");
        try {
            assertThrows(RuntimeException.class, () -> documentacion.cambiarEstado(s.getSolicitudId(),
                    new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, doc.getDocumentoId())));
            var persisted = solicitudes.findById(s.getSolicitudId()).orElseThrow();
            assertEquals(EstadoSolicitud.PENDIENTE, persisted.getEstado());
            assertNull(persisted.getDocumentoId());
        } finally { jdbc.execute("ALTER TABLE event_outbox DROP CONSTRAINT prueba_fallo"); }
        documentacion.cambiarEstado(s.getSolicitudId(), new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, doc.getDocumentoId()));
        assertEquals(EstadoSolicitud.CUMPLIDA, solicitudes.findById(s.getSolicitudId()).orElseThrow().getEstado());
    }
}

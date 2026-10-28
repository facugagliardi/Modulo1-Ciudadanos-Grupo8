package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Prueba opt-in contra PostgreSQL de pruebas; nunca usa la conexion de application.yml. */
@EnabledIfEnvironmentVariable(named = "M1_TEST_POSTGRES_URL", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TramitesExternosPostgresTest {
    private static final UUID CITIZEN = UUID.fromString("b63f5a2e-4b71-46e7-8b01-381c85d88f62");
    private static final String TICKET = "550e8400-e29b-41d4-a716-446655440000";
    private final ObjectMapper mapper = new ObjectMapper();
    private final CiudadanoRepository ciudadanos = mock(CiudadanoRepository.class);
    private final AutorizacionService permisos = mock(AutorizacionService.class);
    private final String schema = "m1_test_" + UUID.randomUUID().toString().replace("-", "");
    private JdbcTemplate base;
    private JdbcTemplate jdbc;
    private DriverManagerDataSource datasource;
    private TransactionTemplate transaction;
    private TramitesExternosService service;

    @BeforeAll
    void baseAislada() {
        String url = System.getenv("M1_TEST_POSTGRES_URL");
        var root = new DriverManagerDataSource(url, "postgres", "");
        base = new JdbcTemplate(root);
        base.execute("CREATE SCHEMA " + schema);
        datasource = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, "postgres", "");
        jdbc = new JdbcTemplate(datasource);
        jdbc.execute("CREATE TABLE ciudadano(ciudadano_id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE cuenta_empleado(empleado_id BIGINT PRIMARY KEY)");
        jdbc.update("INSERT INTO ciudadano VALUES (99)");
        jdbc.update("INSERT INTO cuenta_empleado VALUES (14)");
        jdbc.execute("""
                CREATE TABLE events(event_id VARCHAR(36) PRIMARY KEY, aggregate_type VARCHAR(100) NOT NULL,
                aggregate_id VARCHAR(100) NOT NULL, event_type VARCHAR(100) NOT NULL, payload TEXT NOT NULL,
                type VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ DEFAULT now())
                """);
        migrar();
        transaction = new TransactionTemplate(new DataSourceTransactionManager(datasource));
        service = new TramitesExternosService(jdbc, mapper, ciudadanos, permisos);
    }

    private void migrar() {
        new ResourceDatabasePopulator(new FileSystemResource(Path.of("db/03_integracion_m2_m5.sql"))).execute(datasource);
    }

    @BeforeEach
    void limpiar() {
        jdbc.execute("TRUNCATE tramite_externo, events");
        reset(permisos);
        Ciudadano ciudadano = new Ciudadano(); ciudadano.setId(99L); ciudadano.setUuid(CITIZEN);
        when(ciudadanos.findByUuid(CITIZEN)).thenReturn(Optional.of(ciudadano));
        when(ciudadanos.existsById(99L)).thenReturn(true);
        when(permisos.actual()).thenReturn(new AuthPrincipal(99L, TipoSujeto.CIUDADANO, "PERSONA", CITIZEN));
    }

    @AfterAll
    void cerrar() { if (base != null) base.execute("DROP SCHEMA " + schema + " CASCADE"); }

    @Test
    void migracionConservaUuidDeEmpleadosAlReejecutarse() {
        UUID original = jdbc.queryForObject("SELECT uuid FROM cuenta_empleado WHERE empleado_id=14", UUID.class);
        migrar();
        assertThat(jdbc.queryForObject("SELECT uuid FROM cuenta_empleado WHERE empleado_id=14", UUID.class)).isEqualTo(original);
        assertThat(original.version()).isEqualTo(4);
    }

    @Test
    void altaDuplicadaConcurrenteSeAplicaUnaVez() {
        ObjectNode evento = ticket("ticketCreated", "2026-10-27T10:00:00-03:00");
        var a = CompletableFuture.supplyAsync(() -> aplicar(evento));
        var b = CompletableFuture.supplyAsync(() -> aplicar(evento));
        assertThat(List.of(a.join(), b.join())).containsExactlyInAnyOrder("APLICADO", "DUPLICADO");
        assertThat(cantidad("events")).isEqualTo(1);
        assertThat(cantidad("tramite_externo")).isEqualTo(1);
    }

    @Test
    void ignoraAnonimosYHechosOperativosDesconocidos() {
        ObjectNode anonimo = ticket("ticketUpdated", "2026-10-27T10:00:00-03:00");
        ((ObjectNode) anonimo.get("data")).put("isAnonymous", true).putNull("citizenId");
        assertThat(aplicar(anonimo)).isEqualTo("IGNORADO_ANONIMO");
        assertThat(aplicar(ticket("updateTicketStatus", "2026-10-27T10:00:00-03:00"))).isEqualTo("IGNORADO_DESCONOCIDO");
        assertThat(cantidad("tramite_externo")).isZero();
    }

    @Test
    void respetaOrdenTemporalYNoPersisteMensajesInternos() {
        aplicar(ticket("ticketCreated", "2026-10-27T10:00:00-03:00"));
        ObjectNode evento = ticket("ticketUpdated", "2026-10-27T12:00:00-03:00");
        ((ObjectNode) evento.get("data")).put("currentStatus", "ROUTED");
        aplicar(evento);
        ObjectNode operativo = ticket("updateTicketStatus", "2026-10-27T13:00:00-03:00");
        ((ObjectNode) operativo.get("data")).put("internalMessage", "SECRETO INTERNO")
                .put("publicMessage", "Estamos trabajando").put("summary", "No debe reemplazar el snapshot de M2");
        assertThat(aplicar(operativo)).isEqualTo("APLICADO");
        assertThat(aplicar(ticket("ticketUpdated", "2026-10-27T11:00:00-03:00"))).isEqualTo("IGNORADO_ANTIGUO");
        var tramite = service.listar(99L).getFirst();
        assertThat(tramite.estado()).isEqualTo("IN_PROGRESS");
        assertThat(tramite.datos().path("summary").asText()).isEqualTo("Luminaria apagada");
        assertThat(tramite.datos().path("publicMessage").asText()).isEqualTo("Estamos trabajando");
        assertThat(jdbc.queryForList("SELECT payload FROM events", String.class)).allSatisfy(payload ->
                assertThat(payload).doesNotContain("internalMessage", "SECRETO INTERNO"));
    }

    @Test
    void snapshotTardioCompletaContenidoSinRetrocederEstado() {
        ObjectNode actualizado = ticket("ticketUpdated", "2026-10-27T12:00:00-03:00");
        ((ObjectNode) actualizado.get("data")).remove("summary");
        aplicar(actualizado);
        aplicar(ticket("ticketCreated", "2026-10-27T10:00:00-03:00"));
        var tramite = service.listar(99L).getFirst();
        assertThat(tramite.estado()).isEqualTo("ROUTED");
        assertThat(tramite.datos().path("summary").asText()).isEqualTo("Luminaria apagada");
    }

    @Test
    void falloRevierteRecepcionYPermiteReintento() {
        ObjectNode evento = ticket("ticketCreated", "2026-10-27T10:00:00-03:00");
        assertThatThrownBy(() -> transaction.execute(status -> {
            service.procesar(evento);
            throw new IllegalStateException("Caida antes del commit");
        })).hasMessageContaining("Caida");
        assertThat(cantidad("events")).isZero();
        assertThat(cantidad("tramite_externo")).isZero();
        assertThat(aplicar(evento)).isEqualTo("APLICADO");
    }

    @Test
    void rentasConservaEstadoNuevoAunquePedidoLlegueDespues() {
        for (String[] par : List.of(new String[]{"exemptionRequested", "updateExemptionStatus", "APPROVED"},
                new String[]{"paymentPlanRequested", "updatePaymentPlanStatus", "GRANTED"})) {
            ObjectNode actualizado = rentas(par[1], "2026-10-27T12:00:00-03:00");
            ((ObjectNode) actualizado.get("data")).put("status", par[2]);
            aplicar(actualizado);
            assertThat(aplicar(rentas(par[0], "2026-10-27T10:00:00-03:00"))).isEqualTo("IGNORADO_ANTIGUO");
        }
        assertThat(service.listar(99L)).extracting(TramitesExternosService.Tramite::estado).containsExactlyInAnyOrder("APPROVED", "GRANTED");
        assertThat(cantidad("events")).isEqualTo(4);
    }

    @Test
    void rechazoDeRentasNoInventaOtorgamientoNiExpediente() {
        ObjectNode rechazado = rentas("updatePaymentPlanStatus", "2026-10-27T12:00:00-03:00");
        ((ObjectNode) rechazado.get("data")).put("status", "REJECTED").put("reason", "No cumple condiciones");
        aplicar(rechazado);
        var tramite = service.listar(99L).getFirst();
        assertThat(tramite.estado()).isEqualTo("REJECTED");
        assertThat(tramite.datos().has("planId")).isFalse();
    }

    @Test
    void ciudadanoInexistenteNoSeAsignaAlPrimerRegistro() {
        ObjectNode evento = ticket("ticketCreated", "2026-10-27T10:00:00-03:00");
        ((ObjectNode) evento.get("data")).put("citizenId", UUID.randomUUID().toString());
        assertThatThrownBy(() -> aplicar(evento)).hasMessageContaining("citizenId");
        assertThat(cantidad("events")).isZero();
    }

    @Test
    void admiteFechaLegacyPeroRechazaDosFechasContradictorias() {
        ObjectNode evento = rentas("exemptionRequested", "2026-10-27T10:00:00-03:00");
        evento.set("occuredAt", evento.remove("occurredAt"));
        assertThat(aplicar(evento)).isEqualTo("APLICADO");
        evento.put("eventId", UUID.randomUUID().toString()).put("occurredAt", "2026-10-27T15:00:00-03:00");
        assertThatThrownBy(() -> aplicar(evento)).hasMessageContaining("grafias");
    }

    @Test
    void empleadoConMismoNumeroNoSeConsideraTitular() {
        when(permisos.actual()).thenReturn(new AuthPrincipal(99L, TipoSujeto.EMPLEADO, "PERSONA"));
        doThrow(ar.edu.uade.ciudadanos.common.ApiException.prohibido("Sin permiso de terceros"))
                .when(permisos).exigir(eq(Permiso.LEER_TERCEROS), anyString());
        assertThatThrownBy(() -> service.listar(99L)).hasMessageContaining("Sin permiso");
    }

    private int cantidad(String tabla) { return jdbc.queryForObject("SELECT count(*) FROM " + tabla, Integer.class); }
    private String aplicar(ObjectNode evento) { return transaction.execute(status -> service.procesar(evento)); }

    private ObjectNode ticket(String tipo, String fecha) {
        ObjectNode e = sobre(tipo, tipo.equals("updateTicketStatus") ? "obras" : "atencion-ciudadana", fecha);
        ObjectNode d = (ObjectNode) e.get("data");
        d.put("ticketId", TICKET).put("citizenId", CITIZEN.toString()).put("isAnonymous", false)
                .put("publicId", "TK-2026-000123").put("summary", "Luminaria apagada").put("status", "REGISTERED")
                .put("responsibleAreaId", "M3").put("currentStatus", "ROUTED")
                .put("updateType", tipo.equals("updateTicketStatus") ? "STARTED" : "STATUS_CHANGED")
                .put("createdAt", fecha).put("updatedAt", fecha).put("updateOccurredAt", fecha);
        return e;
    }

    private ObjectNode rentas(String tipo, String fecha) {
        ObjectNode e = sobre(tipo, "rentas", fecha);
        ((ObjectNode) e.get("data")).put("requestId", tipo.toLowerCase().contains("exemption") ? "exr-600" : "ppr-800")
                .put("citizenId", CITIZEN.toString());
        return e;
    }

    private ObjectNode sobre(String tipo, String source, String fecha) {
        ObjectNode e = mapper.createObjectNode();
        e.put("eventId", UUID.randomUUID().toString()).put("eventType", tipo).put("sourceModule", source).put("occurredAt", fecha);
        e.putObject("data");
        return e;
    }
}

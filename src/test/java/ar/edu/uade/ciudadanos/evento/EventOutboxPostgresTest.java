package ar.edu.uade.ciudadanos.evento;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named = "M1_TEST_POSTGRES_URL", matches = ".+")
class EventOutboxPostgresTest {
    private JdbcTemplate jdbc;
    private JdbcTemplate admin;
    private String schema;
    private RabbitTemplate rabbit;
    private EventOutbox outbox;
    private TransactionTemplate tx;
    private DataSourceTransactionManager manager;

    @BeforeEach void preparar() {
        String url = System.getenv("M1_TEST_POSTGRES_URL");
        String user = System.getenv("M1_TEST_POSTGRES_USER"), password = System.getenv("M1_TEST_POSTGRES_PASSWORD");
        admin = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
        schema = "outbox_" + UUID.randomUUID().toString().replace("-", "");
        admin.execute("CREATE SCHEMA " + schema);
        var ds = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, user, password);
        jdbc = new JdbcTemplate(ds);
        new ResourceDatabasePopulator(new FileSystemResource("db/01_schema.sql"),
                new FileSystemResource("db/04_integracion_social_segura.sql")).execute(ds);
        rabbit = mock(RabbitTemplate.class);
        manager = new DataSourceTransactionManager(ds);
        tx = new TransactionTemplate(manager);
        outbox = new EventOutbox(jdbc, rabbit, manager);
        ReflectionTestUtils.setField(outbox, "exchange", "muni.inbox");
    }

    @AfterEach void limpiar() { if (schema != null) admin.execute("DROP SCHEMA " + schema + " CASCADE"); }

    private String encolar() {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO events(event_id,aggregate_type,aggregate_id,event_type,payload,type) VALUES (?,'citizens','1','citizenUpdated','{}','EMITIDO')", id);
        outbox.encolar(id, "citizenUpdated", "{\"eventId\":\"" + id + "\"}");
        return id;
    }

    private void confirmar() {
        doAnswer(inv -> {
            CorrelationData c = inv.getArgument(3);
            c.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbit).send(eq("muni.inbox"), eq("citizenUpdated"), any(Message.class), any(CorrelationData.class));
    }

    @Test void rollbackNoPublicaNiDejaIntencion() {
        tx.executeWithoutResult(s -> { encolar(); s.setRollbackOnly(); });
        outbox.despachar();
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM events", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM event_outbox", Integer.class));
        verifyNoInteractions(rabbit);
    }

    @Test void migracionCompletaUuidHistoricosYLosConservaAlRepetir() {
        jdbc.update("INSERT INTO ciudadano(documento_id,nombre,apellido,fecha_nacimiento,cuit) VALUES ('1','Prueba','Migracion','1990-01-01',1)");
        long titular = jdbc.queryForObject("SELECT ciudadano_id FROM ciudadano WHERE documento_id='1'", Long.class);
        for (String table : new String[]{"documento", "expediente", "solicitud_documentacion"}) {
            jdbc.execute("ALTER TABLE " + table + " DROP COLUMN uuid");
        }
        jdbc.execute("ALTER TABLE solicitud_documentacion DROP COLUMN contexto_social");
        jdbc.execute("ALTER TABLE solicitud_documentacion ALTER COLUMN plazo SET NOT NULL");
        jdbc.update("INSERT INTO documento(ciudadano_id,tipo_documento,cargado_por) VALUES (?,'DNI','prueba')", titular);
        jdbc.update("INSERT INTO expediente(numero,ciudadano_id,area_iniciadora,caratula) VALUES ('EXP-1',?,'Mesa','Historico')", titular);
        jdbc.update("INSERT INTO solicitud_documentacion(titular_id,tipo_documento,plazo) VALUES (?,'DNI',current_date)", titular);
        var migration = new ResourceDatabasePopulator(new FileSystemResource("db/04_integracion_social_segura.sql"));
        migration.execute(jdbc.getDataSource());
        var uuids = new java.util.HashMap<String, UUID>();
        for (String table : new String[]{"documento", "expediente", "solicitud_documentacion"}) {
            uuids.put(table, jdbc.queryForObject("SELECT uuid FROM " + table, UUID.class));
            assertNotNull(uuids.get(table));
        }
        migration.execute(jdbc.getDataSource());
        uuids.forEach((table, uuid) -> assertEquals(uuid, jdbc.queryForObject("SELECT uuid FROM " + table, UUID.class)));
        jdbc.update("INSERT INTO solicitud_documentacion(titular_id,tipo_documento) VALUES (?,'OTRO')", titular);
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM solicitud_documentacion", Integer.class));
    }

    @Test void trabajadorNoVeIntencionesSinCommit() throws Exception {
        confirmar();
        try (var executor = Executors.newSingleThreadExecutor()) {
            tx.executeWithoutResult(s -> {
                encolar();
                try { executor.submit(outbox::despachar).get(5, TimeUnit.SECONDS); }
                catch (Exception e) { throw new IllegalStateException(e); }
                verifyNoInteractions(rabbit);
            });
            outbox.despachar();
            verify(rabbit).send(anyString(), anyString(), any(Message.class), any(CorrelationData.class));
        }
    }

    @Test void caidaYReinicioReenvianElMismoEventId() {
        String id = tx.execute(s -> encolar());
        doThrow(new AmqpException("broker caido")).when(rabbit).send(anyString(), anyString(), any(Message.class), any(CorrelationData.class));
        outbox.despachar();
        assertNull(jdbc.queryForObject("SELECT sent_at FROM event_outbox WHERE event_id=?", Object.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT attempts FROM event_outbox WHERE event_id=?", Integer.class, id));
        reset(rabbit);
        confirmar();
        jdbc.update("UPDATE event_outbox SET next_attempt_at=now() WHERE event_id=?", id);
        outbox.despachar();
        assertNotNull(jdbc.queryForObject("SELECT sent_at FROM event_outbox WHERE event_id=?", Object.class, id));
        verify(rabbit).send(eq("muni.inbox"), eq("citizenUpdated"), argThat(m ->
                id.equals(m.getMessageProperties().getMessageId())
                && m.getMessageProperties().getDeliveryMode() == org.springframework.amqp.core.MessageDeliveryMode.PERSISTENT
                && new String(m.getBody(), java.nio.charset.StandardCharsets.UTF_8).contains(id)), argThat(c -> id.equals(c.getId())));
    }

    @Test void nackNoMarcaEntregado() {
        tx.executeWithoutResult(s -> encolar());
        doAnswer(inv -> {
            ((CorrelationData) inv.getArgument(3)).getFuture().complete(new CorrelationData.Confirm(false, "rechazado"));
            return null;
        }).when(rabbit).send(anyString(), anyString(), any(Message.class), any(CorrelationData.class));
        outbox.despachar();
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM event_outbox WHERE sent_at IS NOT NULL", Integer.class));
    }

    @Test void dosTrabajadoresNoDespachanLaMismaFila() throws Exception {
        tx.executeWithoutResult(s -> encolar());
        var entro = new CountDownLatch(1);
        var continuar = new CountDownLatch(1);
        doAnswer(inv -> {
            entro.countDown();
            assertTrue(continuar.await(5, TimeUnit.SECONDS));
            ((CorrelationData) inv.getArgument(3)).getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbit).send(anyString(), anyString(), any(Message.class), any(CorrelationData.class));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var primero = executor.submit(outbox::despachar);
            assertTrue(entro.await(5, TimeUnit.SECONDS));
            executor.submit(outbox::despachar).get(5, TimeUnit.SECONDS);
            continuar.countDown();
            primero.get(5, TimeUnit.SECONDS);
        } finally { continuar.countDown(); }
        verify(rabbit, times(1)).send(anyString(), anyString(), any(Message.class), any(CorrelationData.class));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "M1_TEST_RABBIT_PORT", matches = ".+")
    void brokerRealConfirmaEntregaYDevuelveMensajesSinDestino() {
        var factory = new org.springframework.amqp.rabbit.connection.CachingConnectionFactory("127.0.0.1",
                Integer.parseInt(System.getenv("M1_TEST_RABBIT_PORT")));
        factory.setPublisherConfirmType(org.springframework.amqp.rabbit.connection.CachingConnectionFactory.ConfirmType.CORRELATED);
        factory.setPublisherReturns(true);
        var real = new RabbitTemplate(factory);
        real.setMandatory(true);
        var adminRabbit = new org.springframework.amqp.rabbit.core.RabbitAdmin(real);
        String exchange = "prueba.outbox." + UUID.randomUUID();
        String queue = "prueba.outbox." + UUID.randomUUID();
        var binding = new org.springframework.amqp.core.Binding(queue, org.springframework.amqp.core.Binding.DestinationType.QUEUE,
                exchange, "", null);
        try {
            adminRabbit.declareExchange(new org.springframework.amqp.core.FanoutExchange(exchange, false, false));
            adminRabbit.declareQueue(new org.springframework.amqp.core.Queue(queue, false, true, true));
            adminRabbit.declareBinding(binding);
            var realOutbox = new EventOutbox(jdbc, real, manager);
            ReflectionTestUtils.setField(realOutbox, "exchange", exchange);
            String id = tx.execute(s -> encolar());
            realOutbox.despachar();
            Message delivered = real.receive(queue, 2000);
            assertNotNull(delivered);
            assertEquals(id, delivered.getMessageProperties().getMessageId());
            assertNotNull(jdbc.queryForObject("SELECT sent_at FROM event_outbox WHERE event_id=?", Object.class, id));
            adminRabbit.removeBinding(binding);
            String returnedId = tx.execute(s -> encolar());
            realOutbox.despachar();
            assertNull(jdbc.queryForObject("SELECT sent_at FROM event_outbox WHERE event_id=?", Object.class, returnedId));
            assertEquals(1, jdbc.queryForObject("SELECT attempts FROM event_outbox WHERE event_id=?", Integer.class, returnedId));
        } finally {
            adminRabbit.deleteQueue(queue);
            adminRabbit.deleteExchange(exchange);
            factory.destroy();
        }
    }
}

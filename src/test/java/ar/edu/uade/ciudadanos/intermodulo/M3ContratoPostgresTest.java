package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.evento.dto.CaseFileResolvedData;
import ar.edu.uade.ciudadanos.expediente.ExpedienteService;
import ar.edu.uade.ciudadanos.expediente.dto.ResolverObraRequest;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository;
import ar.edu.uade.ciudadanos.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="M1_TEST_POSTGRES_URL", matches=".+")
@SpringBootTest(properties={"spring.config.import=", "app.events.outbox-enabled=false",
        "spring.rabbitmq.listener.simple.auto-startup=false", "spring.jpa.properties.hibernate.format_sql=false"})
@AutoConfigureMockMvc
class M3ContratoPostgresTest {
    private static final String SCHEMA="m3_"+UUID.randomUUID().toString().replace("-", "");
    private static JdbcTemplate admin;
    @DynamicPropertySource static void configurar(DynamicPropertyRegistry p) {
        byte[] bytes=new byte[32]; new java.security.SecureRandom().nextBytes(bytes);
        String secret=java.util.Base64.getEncoder().encodeToString(bytes);
        p.add("app.jwt.secret", () -> secret);
        String url=System.getenv("M1_TEST_POSTGRES_URL"), user=System.getenv("M1_TEST_POSTGRES_USER"), pass=System.getenv("M1_TEST_POSTGRES_PASSWORD");
        admin=new JdbcTemplate(new DriverManagerDataSource(url,user,pass));
        admin.execute("CREATE SCHEMA "+SCHEMA);
        String scoped=url+(url.contains("?")?"&":"?")+"currentSchema="+SCHEMA;
        var ds=new DriverManagerDataSource(scoped,user,pass);
        new ResourceDatabasePopulator(new FileSystemResource("db/01_schema.sql"),new FileSystemResource("db/05_integracion_obras.sql"),
                new FileSystemResource("db/05_integracion_obras.sql"), new FileSystemResource("db/07_resolucion_obras.sql"),
                new FileSystemResource("db/07_resolucion_obras.sql")).execute(ds);
        p.add("spring.datasource.url", () -> scoped); p.add("spring.datasource.username", () -> user); p.add("spring.datasource.password", () -> pass);
    }
    @AfterAll static void limpiar(){if(admin!=null) admin.execute("DROP SCHEMA "+SCHEMA+" CASCADE");}
    @AfterEach void salir(){SecurityContextHolder.clearContext();}
    @Autowired ProyectosObrasService obras;
    @Autowired ExpedienteService expedientes;
    @Autowired ExpedienteRepository repo;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired MockMvc mvc;

    @BeforeEach void aislarCasos() {
        jdbc.execute("TRUNCATE event_outbox, events, proyecto_obra_externo, expediente CASCADE");
    }

    private ObjectNode evento(UUID project, boolean approval) {
        var e=mapper.createObjectNode();
        e.put("eventId",UUID.randomUUID().toString()).put("eventType",approval?"publicWorksProjectApproved":"publicWorksProjectCompleted")
                .put("eventVersion","1.0").put("sourceModule","obras").put("occurredAt","2026-11-02T10:00:00Z")
                .put("correlationId",UUID.randomUUID().toString());
        var d=e.putObject("data"); d.put("publicWorksProjectId",project.toString()).put("projectNumber","OBRA-1");
        if(approval)d.put("name","Renovación de plaza").put("approvedAt","2026-11-01T12:00:00Z").put("approvedBudget",20000000);
        else d.put("completedAt","2026-12-01T12:00:00Z").put("finalBudget",19500000);
        return e;
    }
    private long exp(UUID project){return jdbc.queryForObject("SELECT expediente_id FROM proyecto_obra_externo WHERE project_id=?",Long.class,project);}
    private void sesion(long id,TipoSujeto tipo,String rol){SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new AuthPrincipal(id,tipo,rol),null,java.util.List.of()));}
    private int recibidos(String eventId){return jdbc.queryForObject("SELECT count(*) FROM events WHERE event_id=?",Integer.class,eventId);}

    @Test void expedienteInstitucionalYFinalizacionNoResuelvenNiPublican() throws Exception {
        UUID id=UUID.randomUUID(); var a=evento(id,true);
        assertEquals("APLICADO",obras.procesar(a));
        var e=repo.findById(exp(id)).orElseThrow();
        assertNull(e.getCiudadanoId()); assertEquals(id,e.getPublicWorksProjectId()); assertEquals("APPROVED",e.getEstadoObra());
        assertEquals("DUPLICADO",obras.procesar(a));
        var completed=evento(id,false); ((ObjectNode)completed.path("data")).put("caseFileId",e.getUuid().toString());
        assertEquals("APLICADO",obras.procesar(completed));
        e=repo.findById(exp(id)).orElseThrow();
        assertEquals(EstadoExpediente.INICIADO,e.getEstado()); assertEquals("COMPLETED",e.getEstadoObra());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM expediente WHERE public_works_project_id=?",Integer.class,id));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM event_outbox",Integer.class));
        sesion(99L,TipoSujeto.EMPLEADO,"ADMINISTRATIVO");
        expedientes.cambiarEstado(e.getExpedienteId(),EstadoExpediente.EN_TRAMITE);
        long expedienteId = e.getExpedienteId();
        assertThrows(ApiException.class, () -> expedientes.cambiarEstado(expedienteId,EstadoExpediente.RESUELTO));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM event_outbox",Integer.class));
        expedientes.resolverObra(expedienteId, new ResolverObraRequest("rejected", "Dictamen desfavorable real"));
        var resolved=CaseFileResolvedData.preparar(repo.findById(expedienteId).orElseThrow(),"rejected","Dictamen desfavorable real");
        assertEquals(e.getUuid(),resolved.caseFileId()); assertEquals(id.toString(),resolved.externalReference().get("id"));
        assertEquals("rejected",resolved.resolution());
        assertEquals("EMPLEADO:99:ADMINISTRATIVO",repo.findById(expedienteId).orElseThrow().getResueltoPor());
        String eventId=repo.findById(expedienteId).orElseThrow().getResolucionEventId().toString();
        var publicado=mapper.readTree(jdbc.queryForObject("SELECT payload FROM events WHERE event_id=?",String.class,eventId));
        assertEquals(a.path("correlationId").asText(),publicado.path("correlationId").asText());
        assertEquals("caseFileResolved",publicado.path("eventType").asText());
        assertEquals("ciudadanos",publicado.path("sourceModule").asText());
        assertEquals("rejected",publicado.path("data").path("resolution").asText());
        assertEquals(id.toString(),publicado.path("data").path("externalReference").path("id").asText());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM event_outbox WHERE event_id=?",Integer.class,eventId));
        assertThrows(ApiException.class, () -> expedientes.resolverObra(expedienteId,new ResolverObraRequest("approved","Segundo dictamen")));
    }

    @Test void falloDelOutboxRevierteEstadoDictamenYEvento() {
        UUID project=UUID.randomUUID(); obras.procesar(evento(project,true)); long id=exp(project);
        sesion(99L,TipoSujeto.EMPLEADO,"ADMINISTRATIVO");
        expedientes.cambiarEstado(id,EstadoExpediente.EN_TRAMITE);
        jdbc.execute("ALTER TABLE event_outbox ADD CONSTRAINT prueba_fallo_resolucion CHECK (routing_key <> 'caseFileResolved') NOT VALID");
        try {
            assertThrows(RuntimeException.class, () -> expedientes.resolverObra(id,new ResolverObraRequest("approved","Dictamen de prueba")));
            var e=repo.findById(id).orElseThrow();
            assertEquals(EstadoExpediente.EN_TRAMITE,e.getEstado());
            assertNull(e.getResolucionObra()); assertNull(e.getResolucionEventId());
            assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM events WHERE payload::jsonb->'data'->'externalReference'->>'id'=? AND type='EMITIDO'",Integer.class,project.toString()));
        } finally { jdbc.execute("ALTER TABLE event_outbox DROP CONSTRAINT prueba_fallo_resolucion"); }
        assertEquals("approved",expedientes.resolverObra(id,new ResolverObraRequest("approved","Dictamen de prueba")).resolucionObra());
    }

    @Test void resolucionesConcurrentesPublicanUnaSolaVez() throws Exception {
        UUID project=UUID.randomUUID(); obras.procesar(evento(project,true)); long id=exp(project);
        sesion(99L,TipoSujeto.EMPLEADO,"ADMINISTRATIVO"); expedientes.cambiarEstado(id,EstadoExpediente.EN_TRAMITE);
        try(var pool=Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Boolean> resolver=() -> {
                sesion(99L,TipoSujeto.EMPLEADO,"ADMINISTRATIVO");
                try {expedientes.resolverObra(id,new ResolverObraRequest("approved","Dictamen concurrente"));return true;}
                catch(ApiException yaResuelto){return false;}
                finally {SecurityContextHolder.clearContext();}
            };
            var a=pool.submit(resolver); var b=pool.submit(resolver);
            assertNotEquals(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));
        }
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM events WHERE payload::jsonb->'data'->'externalReference'->>'id'=? AND type='EMITIDO'",Integer.class,project.toString()));
    }

    @Test void endpointExigeSesionPermisoYDictamenValido() throws Exception {
        UUID project=UUID.randomUUID(); obras.procesar(evento(project,true)); long id=exp(project);
        sesion(99L,TipoSujeto.EMPLEADO,"ADMINISTRATIVO"); expedientes.cambiarEstado(id,EstadoExpediente.EN_TRAMITE);
        SecurityContextHolder.clearContext();
        String ruta="/expedientes/"+id+"/resolucion-obra";
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(ruta)
                .contentType("application/json").content("{\"resultado\":\"approved\",\"resumen\":\"Dictamen\"}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        var auditor=new UsernamePasswordAuthenticationToken(new AuthPrincipal(99L,TipoSujeto.EMPLEADO,"AUDITOR"),null,java.util.List.of());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(ruta)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication(auditor))
                .contentType("application/json").content("{\"resultado\":\"approved\",\"resumen\":\"Dictamen\"}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        var adminUser=new UsernamePasswordAuthenticationToken(new AuthPrincipal(99L,TipoSujeto.EMPLEADO,"ADMINISTRATIVO"),null,java.util.List.of());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(ruta)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication(adminUser))
                .contentType("application/json").content("{\"resultado\":\"otro\",\"resumen\":\" \"}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
        assertNull(repo.findById(id).orElseThrow().getResolucionObra());
    }

    @Test void completadoAdelantadoSeVinculaAlLlegarLaAprobacion() {
        UUID id=UUID.randomUUID(); assertEquals("APLICADO",obras.procesar(evento(id,false)));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM expediente WHERE public_works_project_id=?",Integer.class,id));
        obras.procesar(evento(id,true));
        var e=repo.findById(exp(id)).orElseThrow(); assertEquals("COMPLETED",e.getEstadoObra());
        var older=evento(id,false); ((ObjectNode)older.path("data")).put("completedAt","2026-11-30T12:00:00Z");
        assertEquals("IGNORADO_ANTIGUO",obras.procesar(older));
        assertEquals("COMPLETED",repo.findById(exp(id)).orElseThrow().getEstadoObra());
    }

    @Test void dosAprobacionesConcurrentesCreanUnSoloExpediente() throws Exception {
        UUID id=UUID.randomUUID(); var a=evento(id,true); var b=evento(id,true);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(() -> obras.procesar(a)); var second=pool.submit(() -> obras.procesar(b));
            var results=java.util.Set.of(first.get(10,TimeUnit.SECONDS),second.get(10,TimeUnit.SECONDS));
            assertEquals(java.util.Set.of("APLICADO","IGNORADO_ANTIGUO"),results);
        }
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM expediente WHERE public_works_project_id=?",Integer.class,id));
    }

    @Test void datosInvalidosNoConsumenElIdYSePuedenCorregir() {
        var e=evento(UUID.randomUUID(),true); var d=(ObjectNode)e.path("data");
        d.put("citizenId",UUID.randomUUID().toString());
        assertThrows(ApiException.class,() -> obras.procesar(e));
        assertEquals(0,recibidos(e.path("eventId").asText()));
        d.remove("citizenId"); e.put("sourceModule","ambiente"); assertThrows(ApiException.class,() -> obras.procesar(e));
        e.put("sourceModule","obras"); d.put("approvedBudget",-1); assertThrows(ApiException.class,() -> obras.procesar(e));
        d.put("approvedBudget",0); d.put("approvedAt","sin-fecha"); assertThrows(ApiException.class,() -> obras.procesar(e));
        d.put("approvedAt","2026-11-01T12:00:00Z"); d.put("campoExtra",true); assertThrows(ApiException.class,() -> obras.procesar(e));
        d.remove("campoExtra"); assertEquals("APLICADO",obras.procesar(e));
    }

    @Test void ciudadanoOpcionalSoloDaLecturaAlTitularCorrecto() {
        UUID citizen=UUID.randomUUID(), project=UUID.randomUUID();
        long identity=System.nanoTime();
        jdbc.update("INSERT INTO ciudadano(uuid,documento_id,nombre,apellido,fecha_nacimiento,cuit) VALUES (?,?,'Prueba','M3','1990-01-01',?)",
                citizen,Long.toString(identity),identity);
        long titular=jdbc.queryForObject("SELECT ciudadano_id FROM ciudadano WHERE uuid=?",Long.class,citizen);
        var e=evento(project,true); ((ObjectNode)e.path("data")).put("citizenId",citizen.toString()); obras.procesar(e);
        sesion(titular,TipoSujeto.CIUDADANO,"PERSONA");
        assertEquals(titular,expedientes.obtener(exp(project)).ciudadanoId());
        assertTrue(expedientes.listar().stream().anyMatch(x -> project.equals(x.publicWorksProjectId())));
        sesion(titular+100000,TipoSujeto.CIUDADANO,"PERSONA"); assertThrows(ApiException.class,() -> expedientes.obtener(exp(project)));
        sesion(titular,TipoSujeto.EMPLEADO,"PERSONA"); assertThrows(ApiException.class,() -> expedientes.obtener(exp(project)));
    }

    @Test void caseFileIdAjenoNoAsociaNiCompletaOtroExpediente() {
        UUID id=UUID.randomUUID(); obras.procesar(evento(id,true)); var e=evento(id,false);
        ((ObjectNode)e.path("data")).put("caseFileId",UUID.randomUUID().toString());
        assertThrows(ApiException.class,() -> obras.procesar(e)); assertEquals(0,recibidos(e.path("eventId").asText()));
        assertEquals("APPROVED",repo.findById(exp(id)).orElseThrow().getEstadoObra());
    }

    @Test void falloAlCrearRevierteElInboxYPermiteReintentar() {
        var e=evento(UUID.randomUUID(),true);
        jdbc.execute("ALTER TABLE expediente ADD CONSTRAINT prueba_fallo_m3 CHECK (numero NOT LIKE 'EXP-M3-%') NOT VALID");
        try { assertThrows(RuntimeException.class,() -> obras.procesar(e)); assertEquals(0,recibidos(e.path("eventId").asText())); }
        finally {jdbc.execute("ALTER TABLE expediente DROP CONSTRAINT prueba_fallo_m3");}
        assertEquals("APLICADO",obras.procesar(e));
    }

    @Test void ciudadanoNoVeInstitucionalYEmpleadoSinPermisoNoHeredaSuId() {
        UUID id=UUID.randomUUID(); obras.procesar(evento(id,true)); long expedienteId=exp(id);
        sesion(1L,TipoSujeto.CIUDADANO,"PERSONA");
        assertThrows(ApiException.class,() -> expedientes.obtener(expedienteId));
        assertThrows(ApiException.class,() -> expedientes.listarActuaciones(expedienteId));
        assertTrue(expedientes.listar().stream().noneMatch(e -> e.expedienteId()==expedienteId));
        sesion(1L,TipoSujeto.EMPLEADO,"PERSONA"); assertThrows(ApiException.class,() -> expedientes.listar());
        sesion(1L,TipoSujeto.EMPLEADO,"AUDITOR");
        assertNull(expedientes.obtener(expedienteId).ciudadanoId());
        assertEquals(id,expedientes.obtener(expedienteId).publicWorksProjectId());
    }
}

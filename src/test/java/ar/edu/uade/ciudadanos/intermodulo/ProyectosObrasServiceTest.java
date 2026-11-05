package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.evento.EventoService;
import ar.edu.uade.ciudadanos.evento.dto.CaseFileResolvedData;
import ar.edu.uade.ciudadanos.expediente.entity.*;
import ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProyectosObrasServiceTest {
    final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    final ExpedienteRepository repo=mock(ExpedienteRepository.class);
    final CiudadanoRepository ciudadanos=mock(CiudadanoRepository.class);
    final EventoService events=mock(EventoService.class);
    final ProyectosObrasService service=new ProyectosObrasService(jdbc,repo,ciudadanos,events);
    final ObjectMapper mapper=new ObjectMapper();

    ObjectNode evento(boolean aprobado) {
        var e=mapper.createObjectNode(); e.put("eventId",UUID.randomUUID().toString()).put("eventType",aprobado?"publicWorksProjectApproved":"publicWorksProjectCompleted")
                .put("sourceModule","obras").put("eventVersion","1.0").put("occurredAt","2026-11-02T12:00:00Z").put("correlationId",UUID.randomUUID().toString());
        var d=e.putObject("data"); d.put("publicWorksProjectId",UUID.randomUUID().toString()).put("projectNumber","OBRA-1");
        if(aprobado)d.put("name","Plaza").put("approvedAt","2026-11-01T12:00:00Z").put("approvedBudget",100);
        else d.put("completedAt","2026-12-01T12:00:00Z").put("finalBudget",90);
        return e;
    }
    void aceptar(){when(events.registrarRecibido(any(),any(),any(),any(),any())).thenReturn(true);}

    @Test void altaInstitucionalUsaUuidRealSinResolver() {
        var e=evento(true); aceptar(); when(repo.saveAndFlush(any())).thenAnswer(i -> {Expediente x=i.getArgument(0);x.setExpedienteId(20L);return x;});
        assertEquals("APLICADO",service.procesar(e));
        verify(repo).saveAndFlush(argThat(x -> x.getCiudadanoId()==null && x.getPublicWorksProjectId().toString().equals(e.path("data").path("publicWorksProjectId").asText())
                && x.getEstado()==EstadoExpediente.INICIADO && x.getEstadoObra().equals("APPROVED") && x.getAreaIniciadora().equals("Obras Públicas")
                && x.getCaratula().equals("Plaza") && x.getFechaInicio().equals(OffsetDateTime.parse("2026-11-01T12:00:00Z"))));
        verifyNoInteractions(ciudadanos);
    }

    @Test void altaConTitularDesconocidoNoConsumeEvento() {
        var e=evento(true); ((ObjectNode)e.path("data")).put("citizenId",UUID.randomUUID().toString());
        assertThrows(ApiException.class,() -> service.procesar(e));verifyNoInteractions(jdbc,events,repo);
    }

    @Test void altaConCiudadanoValidoRespetaSuIdentidad() {
        var e=evento(true); var citizen=UUID.randomUUID(); ((ObjectNode)e.path("data")).put("citizenId",citizen.toString());
        var c=new Ciudadano();c.setId(8L);when(ciudadanos.findByUuid(citizen)).thenReturn(Optional.of(c));
        aceptar();when(repo.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        service.procesar(e);verify(repo).saveAndFlush(argThat(x -> Long.valueOf(8L).equals(x.getCiudadanoId())));
    }

    @Test void duplicadoNoAplicaNada() {
        var e=evento(true);when(events.estaProcesado(any())).thenReturn(true);
        assertEquals("DUPLICADO",service.procesar(e)); verifyNoInteractions(repo);verify(jdbc,never()).update(anyString(),any(Object[].class));
    }

    @Test void rechazoAtomicoDelInboxNoAplica() {
        assertEquals("DUPLICADO",service.procesar(evento(true)));verifyNoInteractions(repo);
    }

    @Test void completadoSinAltaSoloQuedaEnLaProyeccion() {
        aceptar(); assertEquals("APLICADO",service.procesar(evento(false)));verifyNoInteractions(repo);
        verify(jdbc).update(startsWith("UPDATE proyecto_obra_externo SET completed_at"),any(),any(),any());
    }

    @SuppressWarnings({"unchecked","rawtypes"})
    void previo(ObjectNode e, Long expId, OffsetDateTime approved, OffsetDateTime completed) throws Exception {
        when(jdbc.query(eq("SELECT * FROM proyecto_obra_externo WHERE project_id=?"),any(RowMapper.class),any(UUID.class))).thenAnswer(i -> {
            var rs=mock(ResultSet.class); when(rs.getObject("expediente_id",Long.class)).thenReturn(expId);
            when(rs.getObject("approved_at",OffsetDateTime.class)).thenReturn(approved);
            when(rs.getObject("completed_at",OffsetDateTime.class)).thenReturn(completed);
            return List.of(((RowMapper)i.getArgument(1)).mapRow(rs,0));
        });
    }

    @Test void finalizacionActualizaObraSinCambiarEstadoAdministrativo() throws Exception {
        var e=evento(false); previo(e,20L,OffsetDateTime.parse("2026-11-01T12:00:00Z"),null);aceptar();
        var exp=new Expediente();exp.setEstado(EstadoExpediente.EN_TRAMITE);when(repo.findByIdForUpdate(20L)).thenReturn(Optional.of(exp));
        ((ObjectNode)e.path("data")).put("caseFileId",exp.getUuid().toString());
        assertEquals("APLICADO",service.procesar(e));assertEquals("COMPLETED",exp.getEstadoObra());assertEquals(EstadoExpediente.EN_TRAMITE,exp.getEstado());
    }

    @Test void aprobacionAtrasadaConservaLaFinalizacionPrevia() throws Exception {
        var e=evento(true);previo(e,null,null,OffsetDateTime.parse("2026-12-01T12:00:00Z"));aceptar();when(repo.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        service.procesar(e);verify(repo).saveAndFlush(argThat(x -> "COMPLETED".equals(x.getEstadoObra())));
    }

    @Test void actualizacionAntiguaNoSobrescribe() throws Exception {
        var e=evento(true);previo(e,null,OffsetDateTime.parse("2026-11-01T12:00:00Z"),null);aceptar();
        assertEquals("IGNORADO_ANTIGUO",service.procesar(e));verifyNoInteractions(repo);
    }

    @Test void rechazaCambioDeTitularYReferenciaAjena() throws Exception {
        var e=evento(true);previo(e,20L,OffsetDateTime.parse("2026-10-01T12:00:00Z"),null);
        var exp=new Expediente();exp.setCiudadanoId(8L);when(repo.findByIdForUpdate(20L)).thenReturn(Optional.of(exp));
        assertThrows(ApiException.class,() -> service.procesar(e));verify(events,never()).registrarRecibido(any(),any(),any(),any(),any());
        var completion=evento(false);((ObjectNode)completion.path("data")).put("caseFileId",UUID.randomUUID().toString());
        assertThrows(ApiException.class,() -> service.procesar(completion));
    }

    @Test void validacionesDelContratoRechazanAntesDePersistir() {
        for(String key:List.of("eventId","correlationId","sourceModule","eventVersion","occurredAt")) {
            var e=evento(true);e.put(key,"invalido");assertThrows(ApiException.class,() -> service.procesar(e));
        }
        for(String key:List.of("publicWorksProjectId","projectNumber","name","approvedAt")) {
            var e=evento(true);((ObjectNode)e.path("data")).remove(key);assertThrows(ApiException.class,() -> service.procesar(e));
        }
        for(String key:List.of("approvedBudget","citizenId")) {
            var e=evento(true);((ObjectNode)e.path("data")).putNull(key);assertThrows(ApiException.class,() -> service.procesar(e));
        }
        var extraEnvelope=evento(true);extraEnvelope.put("extra",true);assertThrows(ApiException.class,() -> service.procesar(extraEnvelope));
        var extraData=evento(true);((ObjectNode)extraData.path("data")).put("extra",true);assertThrows(ApiException.class,() -> service.procesar(extraData));
        verifyNoInteractions(jdbc,repo,events);
    }

    @Test void respuestaSoloAdmiteDictamenRealConVinculo() {
        var exp=new Expediente();exp.setNumero("EXP-1");exp.setPublicWorksProjectId(UUID.randomUUID());
        assertThrows(IllegalArgumentException.class,() -> CaseFileResolvedData.preparar(exp,"approved","Dictamen"));
        exp.setEstado(EstadoExpediente.RESUELTO);
        var data=CaseFileResolvedData.preparar(exp,"approved","Dictamen"); assertEquals(exp.getUuid(),data.caseFileId());
        assertThrows(IllegalArgumentException.class,() -> CaseFileResolvedData.preparar(exp,"inventado","Dictamen"));
        assertThrows(IllegalArgumentException.class,() -> CaseFileResolvedData.preparar(exp,"approved"," "));
    }

    @Test void rechazaUuidYFechasInvalidasAunqueCoreNoValideFormat() {
        for (boolean aprobado : List.of(true, false)) {
            for (String fecha : List.of("2026-11-02T12:00:00", "2026-02-30T12:00:00Z")) {
                var e = evento(aprobado);
                ((ObjectNode)e.path("data")).put(aprobado ? "approvedAt" : "completedAt", fecha);
                assertThrows(ApiException.class, () -> service.procesar(e));
            }
            for (String id : List.of("no-es-uuid", "1-1-1-1-1")) {
                var e = evento(aprobado);
                ((ObjectNode)e.path("data")).put("publicWorksProjectId", id);
                assertThrows(ApiException.class, () -> service.procesar(e));
            }
        }
        verifyNoInteractions(jdbc, repo, ciudadanos, events);
    }
}

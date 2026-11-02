package ar.edu.uade.ciudadanos.expediente;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.expediente.dto.*;
import ar.edu.uade.ciudadanos.expediente.entity.*;
import ar.edu.uade.ciudadanos.expediente.repository.*;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExpedienteServiceTest {
    private final ExpedienteRepository repo = mock(ExpedienteRepository.class);
    private final ActuacionRepository actuaciones = mock(ActuacionRepository.class);
    private final AutorizacionService auth = mock(AutorizacionService.class);
    private final ExpedienteService service = new ExpedienteService(repo, actuaciones,
            mock(CiudadanoDirectorioService.class), auth, new ObjectMapper());

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" "})
    void generaNumeroSiNoSeInforma(String numero) {
        when(repo.count()).thenReturn(41L);
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        var r = service.crear(new CrearExpedienteRequest(numero, 2L, " prueba ", " mesa "));
        assertEquals("EXP-" + LocalDate.now().getYear() + "-000042", r.numero());
        assertEquals("prueba", r.caratula());
        assertEquals("mesa", r.areaIniciadora());
        assertEquals(EstadoExpediente.INICIADO, r.estado());
    }

    @Test void numeroExplicitoDuplicadoNoSeGuarda() {
        when(repo.existsByNumero("EXP-1")).thenReturn(true);
        assertThrows(ApiException.class, () -> service.crear(new CrearExpedienteRequest(" EXP-1 ", 2L, "x", "mesa")));
        verify(repo, never()).save(any());
    }

    @Test void listadoFiltraPorTitularYLecturaExigePermiso() {
        var e = expediente();
        when(auth.actual()).thenReturn(new AuthPrincipal(2L, TipoSujeto.CIUDADANO, "PERSONA"));
        when(repo.findByCiudadanoId(2L)).thenReturn(List.of(e));
        assertEquals(1, service.listar().size());
        verify(repo, never()).findAll();
        when(auth.puede(Permiso.LEER_TERCEROS)).thenReturn(true);
        when(repo.findAll()).thenReturn(List.of(e));
        assertEquals(1, service.listar().size());
        assertEquals(2L, service.obtener(1L).ciudadanoId());
        verify(auth).exigirLecturaDePersona(2L);
        assertThrows(ApiException.class, () -> service.obtener(99L));
    }

    @Test void transicionesYArchivoImpidenActuacion() {
        var e = expediente();
        service.cambiarEstado(1L, EstadoExpediente.EN_TRAMITE);
        assertEquals(EstadoExpediente.EN_TRAMITE, e.getEstado());
        service.cambiarEstado(1L, EstadoExpediente.RESUELTO);
        service.cambiarEstado(1L, EstadoExpediente.ARCHIVADO);
        assertThrows(ApiException.class, () -> service.cambiarEstado(1L, EstadoExpediente.INICIADO));
        assertThrows(ApiException.class, () -> service.agregarActuacion(1L, new CrearActuacionRequest("INICIO", "x", "M1", null)));
        verify(actuaciones, never()).save(any());
    }

    @Test void actuacionIncrementaOrdenYConservaAdjuntos() {
        expediente();
        Actuacion anterior = new Actuacion(); anterior.setId(new ActuacionId(1L, 5L));
        when(actuaciones.findFirstByIdExpedienteIdOrderByIdActuacionIdDesc(1L)).thenReturn(Optional.of(anterior));
        var r = service.agregarActuacion(1L, new CrearActuacionRequest(" pase ", " texto ", " M1 ", List.of("doc-1")));
        assertEquals(6L, r.actuacionId());
        assertEquals("PASE", r.tipo());
        assertEquals("texto", r.descripcion());
        assertEquals("M1", r.moduloOrigen());
        assertEquals(List.of("doc-1"), r.adjuntos());
        verify(actuaciones).save(argThat(a -> a.getId().getExpedienteId().equals(1L) && a.getAdjuntos().equals("[\"doc-1\"]")));
    }

    @Test void primerActuacionYJsonCorruptoEnHistorial() {
        expediente();
        var r = service.agregarActuacion(1L, new CrearActuacionRequest("INICIO", "texto", "M1", null));
        assertEquals(1L, r.actuacionId());
        assertTrue(r.adjuntos().isEmpty());
        Actuacion a = new Actuacion(); a.setId(new ActuacionId(1L, 1L)); a.setAdjuntos("{roto");
        when(actuaciones.findByIdExpedienteIdOrderByIdActuacionIdAsc(1L)).thenReturn(List.of(a));
        assertTrue(service.listarActuaciones(1L).getFirst().adjuntos().isEmpty());
        verify(auth).exigirLecturaDePersona(2L);
    }

    private Expediente expediente() {
        when(auth.actual()).thenReturn(new AuthPrincipal(2L, TipoSujeto.CIUDADANO, "PERSONA"));
        var e = new Expediente(); e.setExpedienteId(1L); e.setCiudadanoId(2L); e.setEstado(EstadoExpediente.INICIADO);
        when(repo.findById(1L)).thenReturn(Optional.of(e));
        return e;
    }
}

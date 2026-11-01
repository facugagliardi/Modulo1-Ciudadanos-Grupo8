package ar.edu.uade.ciudadanos.documentacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.documentacion.dto.*;
import ar.edu.uade.ciudadanos.documentacion.entity.*;
import ar.edu.uade.ciudadanos.documentacion.repository.SolicitudDocumentacionRepository;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.security.*;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SolicitudDocumentacionServiceTest {
    private final SolicitudDocumentacionRepository repo = mock(SolicitudDocumentacionRepository.class);
    private final DocumentoService documentos = mock(DocumentoService.class);
    private final CiudadanoDirectorioService directorio = mock(CiudadanoDirectorioService.class);
    private final AutorizacionService auth = mock(AutorizacionService.class);
    private final EventPublisherService eventos = mock(EventPublisherService.class);
    private final SolicitudDocumentacionService service = new SolicitudDocumentacionService(repo, documentos, directorio, auth, eventos);

    @Test void creaConPlazoHoyYOrigenPredeterminado() {
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        var r = service.crear(new CrearSolicitudRequest(2L, " dni ", LocalDate.now(), null));
        assertEquals("DNI", r.tipoDocumento());
        assertEquals(EstadoSolicitud.PENDIENTE, r.estado());
        assertEquals(OrigenSolicitud.INTERNA, r.origen());
        assertEquals(2L, r.titularId());
        verify(auth).exigir(Permiso.SOLICITAR_DOCUMENTACION, "solicitar documentacion");
        verify(directorio).exigirQueExista(2L);
        assertEquals(OrigenSolicitud.EVENTO, service.crear(new CrearSolicitudRequest(2L, "DNI", LocalDate.now().plusDays(1), OrigenSolicitud.EVENTO)).origen());
    }

    @Test void rechazaPlazoPasadoYTipoDesconocido() {
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ApiException.class,
                () -> service.crear(new CrearSolicitudRequest(2L, "DNI", LocalDate.now().minusDays(1), null))).getStatus());
        assertThrows(ApiException.class, () -> service.crear(new CrearSolicitudRequest(2L, "INVENTADO", LocalDate.now(), null)));
        verify(repo, never()).save(any());
    }

    @Test void listaSoloPropiasOElPadronSegunPermiso() {
        var s = solicitud(EstadoSolicitud.PENDIENTE);
        when(auth.actual()).thenReturn(new AuthPrincipal(2L, null, "PERSONA"));
        when(repo.findByTitularId(2L)).thenReturn(List.of(s));
        assertEquals(2L, service.listar().getFirst().titularId());
        verify(repo, never()).findAll();
        when(auth.puede(Permiso.LISTAR_PADRON)).thenReturn(true);
        when(repo.findAll()).thenReturn(List.of(s));
        assertEquals(1, service.listar().size());
        assertEquals(2L, service.obtener(1L).titularId());
        verify(auth).exigirLecturaDePersona(2L);
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.obtener(99L)).getStatus());
    }

    @ParameterizedTest @EnumSource(value = EstadoSolicitud.class, names = {"PENDIENTE", "VENCIDA"})
    void cumpleConDocumentoPropioYPublicaEvento(EstadoSolicitud inicial) {
        var s = solicitud(inicial);
        service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, 8L));
        assertEquals(EstadoSolicitud.CUMPLIDA, s.getEstado());
        assertEquals(8L, s.getDocumentoId());
        verify(documentos).exigirDocumentoDe(8L, 2L);
        verify(eventos).publicarSocialDocumentationDelivered(eq("solicitud-cumplida-1"), anyString(), any());
    }

    @Test void noCumpleSinDocumentoOConDocumentoAjeno() {
        var s = solicitud(EstadoSolicitud.PENDIENTE);
        assertThrows(ApiException.class, () -> service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, null)));
        doThrow(ApiException.conflicto("ajeno")).when(documentos).exigirDocumentoDe(8L, 2L);
        assertThrows(ApiException.class, () -> service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, 8L)));
        assertEquals(EstadoSolicitud.PENDIENTE, s.getEstado());
        assertNull(s.getDocumentoId());
        verifyNoInteractions(eventos);
    }

    @Test void vencimientoExigePermisoYEstadoFinalNoSeReabre() {
        var s = solicitud(EstadoSolicitud.PENDIENTE);
        doThrow(ApiException.prohibido("sin permiso")).when(auth).exigir(Permiso.SOLICITAR_DOCUMENTACION, "dar por vencida una solicitud");
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ApiException.class,
                () -> service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.VENCIDA, null))).getStatus());
        assertEquals(EstadoSolicitud.PENDIENTE, s.getEstado());
        doNothing().when(auth).exigir(Permiso.SOLICITAR_DOCUMENTACION, "dar por vencida una solicitud");
        service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.VENCIDA, null));
        assertEquals(EstadoSolicitud.VENCIDA, s.getEstado());
        s.setEstado(EstadoSolicitud.CUMPLIDA);
        assertThrows(ApiException.class, () -> service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.PENDIENTE, null)));
    }

    @Test void permisoEscrituraSeExigeAntesDeMutar() {
        var s = solicitud(EstadoSolicitud.PENDIENTE);
        doThrow(ApiException.prohibido("ajeno")).when(auth).exigirEscrituraSobrePersona(2L);
        assertThrows(ApiException.class, () -> service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, 8L)));
        assertEquals(EstadoSolicitud.PENDIENTE, s.getEstado());
        verifyNoInteractions(documentos, eventos);
    }

    @Test void publicaUuidDelDirectorio() {
        solicitud(EstadoSolicitud.PENDIENTE);
        UUID uuid = UUID.randomUUID();
        when(directorio.resolverUuid(2L)).thenReturn(Optional.of(uuid));
        service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, 8L));
        verify(eventos).publicarSocialDocumentationDelivered(eq("solicitud-cumplida-1"), anyString(), argThat(data ->
                data.citizenId().equals(uuid.toString()) && data.applicationId().equals("sol-1")
                && data.files().getFirst().get("status").equals("COMPLETED")));
    }

    @Test void sinPublicadorPuedeCumplir() {
        var s = solicitud(EstadoSolicitud.PENDIENTE);
        new SolicitudDocumentacionService(repo, documentos, directorio, auth)
                .cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, 8L));
        assertEquals(EstadoSolicitud.CUMPLIDA, s.getEstado());
        verify(documentos).exigirDocumentoDe(8L, 2L);
    }

    /** Caracterizacion del riesgo actual: no acredita entrega ni reproceso del evento. */
    @Test void falloDePublicacionNoRevierteEstadoActual() {
        var s = solicitud(EstadoSolicitud.PENDIENTE);
        doThrow(new IllegalStateException("broker caido")).when(eventos)
                .publicarSocialDocumentationDelivered(anyString(), anyString(), any());
        service.cambiarEstado(1L, new CambioEstadoSolicitudRequest(EstadoSolicitud.CUMPLIDA, 8L));
        assertEquals(EstadoSolicitud.CUMPLIDA, s.getEstado());
        assertEquals(8L, s.getDocumentoId());
    }

    private SolicitudDocumentacion solicitud(EstadoSolicitud estado) {
        var s = new SolicitudDocumentacion();
        s.setSolicitudId(1L); s.setTitularId(2L); s.setTipoDocumento("DNI"); s.setEstado(estado);
        when(repo.findById(1L)).thenReturn(Optional.of(s));
        return s;
    }
}

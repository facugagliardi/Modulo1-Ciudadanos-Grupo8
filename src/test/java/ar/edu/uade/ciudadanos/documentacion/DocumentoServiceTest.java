package ar.edu.uade.ciudadanos.documentacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.documentacion.almacenamiento.AlmacenamientoArchivos;
import ar.edu.uade.ciudadanos.documentacion.dto.ValidarDocumentoRequest;
import ar.edu.uade.ciudadanos.documentacion.entity.Documento;
import ar.edu.uade.ciudadanos.documentacion.entity.ResultadoValidacion;
import ar.edu.uade.ciudadanos.documentacion.repository.DocumentoRepository;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DocumentoServiceTest {
    private final DocumentoRepository repo = mock(DocumentoRepository.class);
    private final AlmacenamientoArchivos archivos = mock(AlmacenamientoArchivos.class);
    private final AutorizacionService auth = mock(AutorizacionService.class);
    private final DocumentoService service = new DocumentoService(repo, archivos,
            mock(CiudadanoDirectorioService.class), auth);

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {true, false})
    void cargaYVersionaSinModificarOriginal(boolean interno) {
        var archivo = new org.springframework.mock.web.MockMultipartFile("archivo", "dni.pdf", "application/pdf", new byte[]{1});
        when(auth.puede(ar.edu.uade.ciudadanos.security.Permiso.VALIDAR_DOCUMENTACION)).thenReturn(interno);
        when(auth.actorActual()).thenReturn("actor");
        when(archivos.guardar(archivo, 2L, 1)).thenReturn("2/dni.pdf");
        when(archivos.guardar(archivo, 2L, 4)).thenReturn("2/nuevo.pdf");
        var captor = org.mockito.ArgumentCaptor.forClass(Documento.class);
        var respuesta = service.cargar(2L, " dni ", archivo);
        assertEquals("DNI", respuesta.tipoDocumento());
        Documento anterior = new Documento();
        anterior.setVersion(3); anterior.setCiudadanoId(2L); anterior.setTipoDocumento("DNI");
        when(repo.findById(1L)).thenReturn(Optional.of(anterior));
        assertEquals(4, service.nuevaVersion(1L, archivo).version());
        verify(repo, times(2)).save(captor.capture());
        for (Documento d : captor.getAllValues()) {
            assertEquals(2L, d.getCiudadanoId());
            assertEquals("actor", d.getCargadoPor());
            assertEquals(interno ? ResultadoValidacion.VALIDADO : ResultadoValidacion.PENDIENTE, d.getResultadoValidacion());
            assertEquals(interno ? "actor" : null, d.getValidadoPor());
        }
        assertEquals("2/nuevo.pdf", captor.getValue().getUrlArchivo());
        assertEquals(3, anterior.getVersion());
        verify(auth, times(2)).exigirEscrituraSobrePersona(2L);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"pdf,application/pdf", "PNG,image/png", "jpg,image/jpeg", "jpeg,image/jpeg", "bin,application/octet-stream"})
    void descargaConMimeYNombre(String extension, String mime) {
        Documento d = new Documento(); d.setCiudadanoId(2L); d.setUrlArchivo("2/prefijo-dni." + extension);
        when(repo.findById(1L)).thenReturn(Optional.of(d));
        var recurso = new org.springframework.core.io.ByteArrayResource(new byte[]{1});
        when(archivos.leer(d.getUrlArchivo())).thenReturn(recurso);
        var r = service.archivoDe(1L);
        assertEquals(mime, r.tipo().toString());
        assertEquals("dni." + extension, r.nombre());
        assertSame(recurso, r.recurso());
        verify(auth).exigirLecturaDePersona(2L);
    }

    @Test void filtraPendientesYExigeLectura() {
        Documento pendiente = new Documento(); pendiente.setCiudadanoId(2L);
        Documento aprobado = new Documento(); aprobado.setResultadoValidacion(ResultadoValidacion.VALIDADO);
        when(repo.findAll()).thenReturn(java.util.List.of(pendiente, aprobado));
        assertEquals(1, service.listarPendientes().size());
        when(repo.findByCiudadanoId(2L)).thenReturn(java.util.List.of(pendiente));
        assertEquals(1, service.listarDeCiudadano(2L).size());
        verify(auth).exigirLecturaDePersona(2L);
        when(repo.findById(1L)).thenReturn(Optional.of(pendiente));
        doThrow(ApiException.prohibido("ajeno")).when(auth).exigirLecturaDePersona(2L);
        assertThrows(ApiException.class, () -> service.obtener(1L));
        assertThrows(ApiException.class, () -> service.archivoDe(1L));
        verifyNoInteractions(archivos);
    }

    @Test void errorAlGuardarArchivoNoPersisteDocumento() {
        when(archivos.guardar(null, 2L, 1)).thenThrow(ApiException.invalido("archivo invalido"));
        assertThrows(ApiException.class, () -> service.cargar(2L, "DNI", null));
        verifyNoInteractions(repo);
    }

    @Test void exigirDocumentoControlaTitularYPermiteVigenciaNula() {
        Documento d = new Documento(); d.setCiudadanoId(2L); d.setResultadoValidacion(ResultadoValidacion.VALIDADO);
        when(repo.findFirstByCiudadanoIdAndTipoDocumentoOrderByVersionDesc(2L, "DNI")).thenReturn(Optional.of(d));
        service.exigirDocumento(2L, "DNI");
        d.setCiudadanoId(3L);
        assertThrows(ApiException.class, () -> service.exigirDocumento(2L, "DNI"));
        assertThrows(ApiException.class, () -> service.obtenerUltimaVersionValida(99L, "DNI"));
    }

    @Test void descargaSinPrefijoYPropagaErrorDeLectura() {
        Documento d = new Documento(); d.setCiudadanoId(2L); d.setUrlArchivo("dni.pdf");
        when(repo.findById(1L)).thenReturn(Optional.of(d));
        assertEquals("dni.pdf", service.archivoDe(1L).nombre());
        when(archivos.leer("dni.pdf")).thenThrow(ApiException.noEncontrado("archivo perdido"));
        assertThrows(ApiException.class, () -> service.archivoDe(1L));
    }

    @Test void escrituraDenegadaNoGuardaArchivosNiVersiones() {
        Documento d = new Documento(); d.setCiudadanoId(2L);
        when(repo.findById(1L)).thenReturn(Optional.of(d));
        doThrow(ApiException.prohibido("ajeno")).when(auth).exigirEscrituraSobrePersona(2L);
        assertThrows(ApiException.class, () -> service.cargar(2L, "DNI", null));
        assertThrows(ApiException.class, () -> service.nuevaVersion(1L, null));
        verifyNoInteractions(archivos);
        verify(repo, never()).save(any());
    }

    @Test void rechazaDocumentoInexistente() {
        assertThrows(ApiException.class, () -> service.obtener(99L));
        verifyNoInteractions(archivos);
    }

    @Test void validaYNoPermiteValidarDosVeces() {
        Documento documento = new Documento();
        when(repo.findById(1L)).thenReturn(Optional.of(documento));
        LocalDate vigencia = LocalDate.now().plusDays(1);
        service.validar(1L, new ValidarDocumentoRequest(true, vigencia));
        assertEquals(ResultadoValidacion.VALIDADO, documento.getResultadoValidacion());
        assertEquals(vigencia, documento.getVigenciaHasta());
        assertNotNull(documento.getFechaValidacion());
        assertThrows(ApiException.class, () -> service.validar(1L, new ValidarDocumentoRequest(false, null)));
        assertEquals(ResultadoValidacion.VALIDADO, documento.getResultadoValidacion());
    }

    @Test void rechazaYControlaTitularYArchivoAusente() {
        Documento documento = new Documento();
        documento.setCiudadanoId(2L);
        when(repo.findById(1L)).thenReturn(Optional.of(documento));
        service.validar(1L, new ValidarDocumentoRequest(false, null));
        assertEquals(ResultadoValidacion.RECHAZADO, documento.getResultadoValidacion());
        service.exigirDocumentoDe(1L, 2L);
        assertThrows(ApiException.class, () -> service.exigirDocumentoDe(1L, 3L));
        assertThrows(ApiException.class, () -> service.archivoDe(1L));
        verifyNoInteractions(archivos);
    }

    @Test void controlaAprobacionYVigenciaInclusiva() {
        Documento documento = new Documento();
        when(repo.findFirstByCiudadanoIdAndTipoDocumentoOrderByVersionDesc(2L, "DNI"))
                .thenReturn(Optional.of(documento));
        assertThrows(ApiException.class, () -> service.obtenerUltimaVersionValida(2L, " dni "));
        documento.setResultadoValidacion(ResultadoValidacion.VALIDADO);
        documento.setVigenciaHasta(LocalDate.now());
        assertSame(documento, service.obtenerUltimaVersionValida(2L, " dni "));
        documento.setVigenciaHasta(LocalDate.now().minusDays(1));
        assertThrows(ApiException.class, () -> service.obtenerUltimaVersionValida(2L, "DNI"));
    }
}

package ar.edu.uade.ciudadanos.contacto;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.contacto.dto.*;
import ar.edu.uade.ciudadanos.contacto.entity.*;
import ar.edu.uade.ciudadanos.contacto.repository.*;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ContactoServiceTest {
    private final ContactoCiudadanoRepository repo = mock(ContactoCiudadanoRepository.class);
    private final ContactoPersonaRepository vinculos = mock(ContactoPersonaRepository.class);
    private final CiudadanoRepository ciudadanos = mock(CiudadanoRepository.class);
    private final AutorizacionService auth = mock(AutorizacionService.class);
    private final ContactoService service = new ContactoService(repo, vinculos, ciudadanos, auth);

    @ParameterizedTest
    @CsvSource({"EMAIL, ' Test@Ejemplo.com ', test@ejemplo.com", "TELEFONO, '+54 11-12345678', +541112345678"})
    void creaNormalizadoYVinculado(TipoContacto tipo, String entrada, String esperado) {
        when(ciudadanos.existsById(2L)).thenReturn(true);
        doAnswer(inv -> { ((ContactoCiudadano) inv.getArgument(0)).setContactoId(8L); return inv.getArgument(0); })
                .when(repo).save(any());
        var respuesta = service.crear(2L, new CrearContactoRequest(tipo, entrada));
        assertEquals(esperado, respuesta.valor());
        assertFalse(respuesta.verificado());
        verify(auth).exigirEscrituraSobrePersona(2L);
        verify(vinculos).save(argThat(v -> v.getId().getCiudadanoId().equals(2L)
                && v.getId().getContactoId().equals(8L)));
    }

    @ParameterizedTest
    @CsvSource({"EMAIL, sin-arroba", "EMAIL, a@b.c", "TELEFONO, abcdefgh", "TELEFONO, 1234567"})
    void rechazaFormatosSinPersistir(TipoContacto tipo, String valor) {
        when(ciudadanos.existsById(2L)).thenReturn(true);
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ApiException.class,
                () -> service.crear(2L, new CrearContactoRequest(tipo, valor))).getStatus());
        verify(repo, never()).save(any());
        verifyNoInteractions(vinculos);
    }

    @Test void rechazaDuplicadoNormalizado() {
        when(ciudadanos.existsById(2L)).thenReturn(true);
        ContactoCiudadano c = contacto();
        c.setTipo(TipoContacto.EMAIL);
        c.setValor("TEST@EJEMPLO.COM");
        when(repo.findByCiudadanoId(2L)).thenReturn(List.of(c));
        assertEquals(HttpStatus.CONFLICT, assertThrows(ApiException.class,
                () -> service.crear(2L, new CrearContactoRequest(TipoContacto.EMAIL, " test@ejemplo.com "))).getStatus());
        verify(repo, never()).save(any());
    }

    @Test void inexistenteYPermisoImpidenCrear() {
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class,
                () -> service.listar(2L)).getStatus());
        when(ciudadanos.existsById(2L)).thenReturn(true);
        doThrow(ApiException.prohibido("ajeno")).when(auth).exigirEscrituraSobrePersona(2L);
        assertThrows(ApiException.class, () -> service.crear(2L, new CrearContactoRequest(TipoContacto.EMAIL, "a@b.com")));
        verifyNoInteractions(repo, vinculos);
    }

    @Test void actualizarInvalidaVerificacionYEliminarRespetaOrden() {
        ContactoCiudadano c = contacto();
        c.setVerificado(true);
        c.setVerificadoEn(OffsetDateTime.now());
        when(auth.puede(Permiso.EDITAR_TERCEROS)).thenReturn(true);
        service.actualizar(8L, new ActualizarContactoRequest(TipoContacto.EMAIL, " nuevo@correo.com "));
        assertEquals("nuevo@correo.com", c.getValor());
        assertFalse(c.isVerificado());
        assertNull(c.getVerificadoEn());
        service.eliminar(8L);
        var orden = inOrder(vinculos, repo);
        orden.verify(vinculos).deleteByIdContactoId(8L);
        orden.verify(repo).delete(c);
    }

    @Test void titularPuedeVerificarUnaVezYAjenoNoPuedeEliminar() {
        ContactoCiudadano c = contacto();
        when(auth.actual()).thenReturn(new AuthPrincipal(2L, null, "PERSONA"));
        when(vinculos.findByIdContactoId(8L)).thenReturn(List.of(new ContactoPersona(new ContactoPersonaId(2L, 8L))));
        service.verificar(8L, "123456");
        assertTrue(c.isVerificado());
        assertNotNull(c.getVerificadoEn());
        assertEquals(HttpStatus.CONFLICT, assertThrows(ApiException.class, () -> service.verificar(8L, "123456")).getStatus());
        when(vinculos.findByIdContactoId(8L)).thenReturn(List.of(new ContactoPersona(new ContactoPersonaId(3L, 8L))));
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ApiException.class, () -> service.eliminar(8L)).getStatus());
        verify(repo, never()).delete(any());
    }

    @Test void listadoExigeLecturaYRecursoInexistenteEs404() {
        when(ciudadanos.existsById(2L)).thenReturn(true);
        ContactoCiudadano c = contacto();
        when(repo.findByCiudadanoId(2L)).thenReturn(List.of(c));
        assertEquals(1, service.listar(2L).size());
        verify(auth).exigirLecturaDePersona(2L);
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.eliminar(99L)).getStatus());
    }

    private ContactoCiudadano contacto() {
        ContactoCiudadano c = new ContactoCiudadano();
        c.setContactoId(8L);
        when(repo.findById(8L)).thenReturn(Optional.of(c));
        return c;
    }
}

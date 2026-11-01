package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CiudadanoDirectorioServiceTest {
    @Test void resuelveIdentidadYUuidSinInventarPersonas() {
        var repo = mock(CiudadanoRepository.class);
        var service = new CiudadanoDirectorioService(repo);
        var c = new Ciudadano(); c.setId(2L); c.setNombre("Ana"); c.setApellido("Perez"); c.setCuit(20111222119L);
        UUID uuid = UUID.randomUUID(); c.setUuid(uuid);
        when(repo.findById(2L)).thenReturn(Optional.of(c));
        when(repo.existsById(2L)).thenReturn(true);
        var p = service.resolver(2L);
        assertEquals(2L,p.personaId()); assertEquals("Ana",p.nombre()); assertEquals("Perez",p.apellido()); assertEquals("20111222119",p.cuit());
        assertEquals(Optional.of(uuid),service.resolverUuid(2L));
        assertTrue(service.existe(2L)); service.exigirQueExista(2L);
        assertFalse(service.existe(null)); assertFalse(service.existe(99L));
        assertTrue(service.resolverUuid(null).isEmpty()); assertTrue(service.resolverUuid(99L).isEmpty());
        assertThrows(ApiException.class,()->service.exigirQueExista(99L));
        assertThrows(ApiException.class,()->service.resolver(99L));
        verify(repo,never()).existsById(null);
    }
}

package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.empleado.entity.CuentaEmpleado;
import ar.edu.uade.ciudadanos.empleado.repository.CuentaEmpleadoRepository;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.repository.OrganizacionRepository;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DirectorioM6ServiceTest {
    private final CiudadanoRepository ciudadanos = mock(CiudadanoRepository.class);
    private final OrganizacionRepository organizaciones = mock(OrganizacionRepository.class);
    private final CuentaEmpleadoRepository empleados = mock(CuentaEmpleadoRepository.class);
    private final AutorizacionService permisos = mock(AutorizacionService.class);
    private final DirectorioM6Service service = new DirectorioM6Service(ciudadanos, organizaciones, empleados, permisos);

    @Test
    void empleadoSinLoginNoSeConfundeConCiudadano() {
        var e = new CuentaEmpleado();
        e.setActivo(false);
        when(empleados.findById(7L)).thenReturn(Optional.of(e));
        var resultado = service.actor("EMPLEADO", 7L);
        assertEquals(e.getUuid(), resultado.actorId());
        assertEquals("INACTIVO", resultado.estado());
        verifyNoInteractions(ciudadanos);
    }

    @Test
    void organizacionInactivaConservaIdentidad() {
        var o = new Organizacion();
        o.setCuit(30712345678L);
        o.setEstado(EstadoOrganizacion.INACTIVA);
        when(organizaciones.findByCuit(30712345678L)).thenReturn(Optional.of(o));
        var resultado = service.organizacionPorCuit("30712345678");
        assertEquals(o.getUuid(), resultado.organizationId());
        assertEquals("INACTIVA", resultado.estado());
    }

    @Test
    void noInventaIdentidadNiAdmiteParametrosAmbiguos() {
        UUID id = UUID.randomUUID();
        when(ciudadanos.findByUuid(id)).thenReturn(Optional.empty());
        assertEquals(404, assertThrows(ApiException.class, () -> service.ciudadano(id)).getStatus().value());
        assertThrows(ApiException.class, () -> service.actor("OTRO", 7L));
        assertThrows(ApiException.class, () -> service.actor("EMPLEADO", 0L));
        assertThrows(ApiException.class, () -> service.organizacionPorCuit("30-71234567-8"));
        verifyNoInteractions(empleados, organizaciones);
    }

    @Test
    void exigePermisoAntesDeConsultar() {
        doThrow(ApiException.prohibido("Sin permiso")).when(permisos)
                .exigir(eq(Permiso.CONSULTA_INTERMODULO), anyString());
        assertThrows(ApiException.class, () -> service.actor("EMPLEADO", 7L));
        assertThrows(ApiException.class, () -> service.ciudadano(UUID.randomUUID()));
        assertThrows(ApiException.class, () -> service.organizacion(UUID.randomUUID()));
        assertThrows(ApiException.class, () -> service.organizacionPorCuit("30712345678"));
        verifyNoInteractions(ciudadanos, organizaciones, empleados);
    }
}

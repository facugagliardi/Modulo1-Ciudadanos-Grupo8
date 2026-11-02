package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.empleado.repository.CuentaEmpleadoRepository;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import ar.edu.uade.ciudadanos.organizacion.repository.OrganizacionRepository;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Directorio acotado: no entrega legajos ni produce eventos por consultar. */
@Service
@Transactional(readOnly = true)
public class DirectorioM6Service {
    private final CiudadanoRepository ciudadanos;
    private final OrganizacionRepository organizaciones;
    private final CuentaEmpleadoRepository empleados;
    private final AutorizacionService permisos;

    public DirectorioM6Service(CiudadanoRepository ciudadanos, OrganizacionRepository organizaciones,
                              CuentaEmpleadoRepository empleados, AutorizacionService permisos) {
        this.ciudadanos = ciudadanos;
        this.organizaciones = organizaciones;
        this.empleados = empleados;
        this.permisos = permisos;
    }

    public CiudadanoInfo ciudadano(UUID id) {
        autorizar();
        var c = ciudadanos.findByUuid(id).orElseThrow(() -> ApiException.noEncontrado("Ciudadano inexistente"));
        return new CiudadanoInfo(c.getUuid(), c.getNombre(), c.getApellido(), c.getEstado().name());
    }

    public OrganizacionInfo organizacion(UUID id) {
        autorizar();
        return resumir(organizaciones.findByUuid(id)
                .orElseThrow(() -> ApiException.noEncontrado("Organizacion inexistente")));
    }

    public OrganizacionInfo organizacionPorCuit(String cuit) {
        autorizar();
        if (cuit == null || !cuit.matches("[0-9]{11}")) {
            throw ApiException.invalido("CUIT debe tener 11 digitos sin separadores");
        }
        return resumir(organizaciones.findByCuit(Long.valueOf(cuit))
                .orElseThrow(() -> ApiException.noEncontrado("Organizacion inexistente")));
    }

    /** El tipo es obligatorio: los espacios numericos de ciudadano y empleado se superponen. */
    public ActorInfo actor(String actorType, Long sub) {
        autorizar();
        if (sub == null || sub <= 0) {
            throw ApiException.invalido("sub debe ser positivo");
        }
        if ("EMPLEADO".equals(actorType)) {
            var e = empleados.findById(sub).orElseThrow(() -> ApiException.noEncontrado("Empleado inexistente"));
            return new ActorInfo(sub.toString(), actorType, e.getUuid(), e.getNombreEmpleado(),
                    e.getApellidoEmpleado(), e.isActivo() ? "ACTIVO" : "INACTIVO");
        }
        if ("CIUDADANO".equals(actorType)) {
            var c = ciudadanos.findById(sub).orElseThrow(() -> ApiException.noEncontrado("Ciudadano inexistente"));
            return new ActorInfo(sub.toString(), actorType, c.getUuid(), c.getNombre(),
                    c.getApellido(), c.getEstado().name());
        }
        throw ApiException.invalido("actorType debe ser EMPLEADO o CIUDADANO");
    }

    private void autorizar() {
        permisos.exigir(Permiso.CONSULTA_INTERMODULO, "consultar directorio intermodulo");
    }

    private OrganizacionInfo resumir(Organizacion o) {
        return new OrganizacionInfo(o.getUuid(), o.getCuit().toString(), o.getRazonSocial(),
                o.getNombre(), o.getEstado().name());
    }

    public record CiudadanoInfo(UUID citizenId, String nombre, String apellido, String estado) { }
    public record OrganizacionInfo(UUID organizationId, String cuit, String razonSocial,
                                   String nombre, String estado) { }
    public record ActorInfo(String sub, String actorType, UUID actorId, String nombre,
                            String apellido, String estado) { }
}

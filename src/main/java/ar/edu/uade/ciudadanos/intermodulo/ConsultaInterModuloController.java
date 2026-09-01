package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.domicilio.DomicilioService;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioPrincipalInterModuloResponse;
import ar.edu.uade.ciudadanos.organizacion.OrganizacionService;
import ar.edu.uade.ciudadanos.organizacion.dto.IdentidadOrganizacionResponse;
import ar.edu.uade.ciudadanos.persona.CiudadanoService;
import ar.edu.uade.ciudadanos.persona.dto.EstadoCiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.dto.IdentidadCiudadanoResponse;
import ar.edu.uade.ciudadanos.security.SoloInterno;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Consultas que hacen los otros modulos (marcadas {@code Svc} en la spec).
 *
 * <p>Devuelven lo minimo necesario para identificar y validar, nunca el legajo
 * completo: es la diferencia con los GET del bloque de ciudadanos.
 *
 * <p>{@code GET /representaciones/vigencia} y {@code GET /ciudadanos/existe},
 * que tambien son Svc, viven en sus controllers por compartir prefijo de ruta.
 */
@RestController
@SoloInterno
public class ConsultaInterModuloController {

    private final CiudadanoService ciudadanoService;
    private final OrganizacionService organizacionService;
    private final DomicilioService domicilioService;

    public ConsultaInterModuloController(CiudadanoService ciudadanoService,
                                         OrganizacionService organizacionService,
                                         DomicilioService domicilioService) {
        this.ciudadanoService = ciudadanoService;
        this.organizacionService = organizacionService;
        this.domicilioService = domicilioService;
    }

    @GetMapping("/ciudadanos/{id}/identidad")
    public IdentidadCiudadanoResponse identidadCiudadano(@PathVariable Long id) {
        return ciudadanoService.identidad(id);
    }

    @GetMapping("/ciudadanos/{id}/estado")
    public EstadoCiudadanoResponse estadoCiudadano(@PathVariable Long id) {
        return ciudadanoService.estado(id);
    }

    @GetMapping("/organizaciones/{id}/identidad")
    public IdentidadOrganizacionResponse identidadOrganizacion(@PathVariable Long id) {
        return organizacionService.identidad(id);
    }

    @GetMapping("/personas/{id}/domicilio-principal")
    public DomicilioPrincipalInterModuloResponse domicilioPrincipal(@PathVariable Long id) {
        return domicilioService.domicilioPrincipal(id);
    }
}

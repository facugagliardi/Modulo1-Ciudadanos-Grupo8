package ar.edu.uade.ciudadanos.organizacion;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.OrganizacionDeDuenoResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Las organizaciones de una persona, vistas desde su titularidad (RF-19).
 *
 * Va en su propio controller y no en {@link OrganizacionController} porque ese
 * tiene la clase mapeada a /organizaciones y esta ruta cuelga de /personas.
 * Es la misma forma que ya usa RepresentacionController para
 * GET /personas/{id}/representaciones.
 */
@RestController
public class TitularidadController {

    private final OrganizacionService organizacionService;

    public TitularidadController(OrganizacionService organizacionService) {
        this.organizacionService = organizacionService;
    }

    @GetMapping("/personas/{id}/organizaciones")
    public ListaResponse<OrganizacionDeDuenoResponse> listarDePersona(@PathVariable Long id) {
        return ListaResponse.de(organizacionService.listarPorDueno(id));
    }
}

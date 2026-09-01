package ar.edu.uade.ciudadanos.organizacion;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.CambioEstadoRepresentacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.CrearRepresentacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.RepresentacionDeOrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.RepresentacionDePersonaResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.RepresentacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.VigenciaRepresentacionResponse;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.security.SoloInterno;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Representaciones (RF-20, RF-21, RF-22). */
@RestController
public class RepresentacionController {

    private final RepresentacionService representacionService;

    public RepresentacionController(RepresentacionService representacionService) {
        this.representacionService = representacionService;
    }

    @PostMapping("/representaciones")
    public ResponseEntity<RepresentacionResponse> crear(@Valid @RequestBody CrearRepresentacionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(representacionService.crear(request));
    }

    /**
     * RF-22. Consulta inter-modulo: ruta literal, matchea antes que
     * /representaciones/{id}. Nunca devuelve 404.
     */
    @SoloInterno
    @GetMapping("/representaciones/vigencia")
    public VigenciaRepresentacionResponse vigencia(@RequestParam Long ciudadanoId,
                                                   @RequestParam Long organizacionId) {
        return representacionService.consultarVigencia(ciudadanoId, organizacionId);
    }

    @GetMapping("/organizaciones/{id}/representaciones")
    public ListaResponse<RepresentacionDeOrganizacionResponse> listarDeOrganizacion(@PathVariable Long id) {
        return ListaResponse.de(representacionService.listarDeOrganizacion(id));
    }

    @GetMapping("/personas/{id}/representaciones")
    public ListaResponse<RepresentacionDePersonaResponse> listarDePersona(@PathVariable Long id) {
        return ListaResponse.de(representacionService.listarDePersona(id));
    }

    @PatchMapping("/representaciones/{id}/estado")
    public CambioEstadoResponse cambiarEstado(@PathVariable Long id,
                                              @Valid @RequestBody CambioEstadoRepresentacionRequest request) {
        return representacionService.cambiarEstado(id, request.estado());
    }
}

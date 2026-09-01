package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.persona.dto.ActualizarRelacionRequest;
import ar.edu.uade.ciudadanos.persona.dto.CambioResponsableRequest;
import ar.edu.uade.ciudadanos.persona.dto.CrearRelacionRequest;
import ar.edu.uade.ciudadanos.persona.dto.RelacionDeCiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.dto.RelacionResponse;
import ar.edu.uade.ciudadanos.persona.dto.ResponsableResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Grupo familiar (RF-16, RF-17, RF-18). */
@RestController
public class RelacionController {

    private final RelacionService relacionService;

    public RelacionController(RelacionService relacionService) {
        this.relacionService = relacionService;
    }

    @PostMapping("/relaciones")
    public ResponseEntity<RelacionResponse> crear(@Valid @RequestBody CrearRelacionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(relacionService.crear(request));
    }

    @GetMapping("/ciudadanos/{id}/relaciones")
    public ListaResponse<RelacionDeCiudadanoResponse> listarDe(@PathVariable Long id) {
        return ListaResponse.de(relacionService.listarDe(id));
    }

    @PutMapping("/relaciones/{id}")
    public RelacionResponse actualizar(@PathVariable Long id,
                                       @Valid @RequestBody ActualizarRelacionRequest request) {
        return relacionService.actualizar(id, request);
    }

    @PatchMapping("/relaciones/{id}/responsable")
    public ResponsableResponse cambiarResponsable(@PathVariable Long id,
                                                  @Valid @RequestBody CambioResponsableRequest request) {
        return relacionService.cambiarResponsable(id, request.esResponsable());
    }

    @DeleteMapping("/relaciones/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        relacionService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}

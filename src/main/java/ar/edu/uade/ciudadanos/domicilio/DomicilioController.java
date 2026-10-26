package ar.edu.uade.ciudadanos.domicilio;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.ActualizarDomicilioRequest;
import ar.edu.uade.ciudadanos.domicilio.dto.CrearDomicilioRequest;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioCerradoResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioCreadoResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioPrincipalResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioResponse;
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

/** Domicilios de un ciudadano (RF-09 a RF-12). */
@RestController
public class DomicilioController {

    private final DomicilioService domicilioService;

    public DomicilioController(DomicilioService domicilioService) {
        this.domicilioService = domicilioService;
    }

    @PostMapping("/ciudadanos/{ciudadanoId}/domicilios")
    public ResponseEntity<DomicilioCreadoResponse> crear(@PathVariable Long ciudadanoId,
                                                         @Valid @RequestBody CrearDomicilioRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(domicilioService.crear(ciudadanoId, request));
    }

    @GetMapping("/ciudadanos/{ciudadanoId}/domicilios")
    public ListaResponse<DomicilioResponse> listar(@PathVariable Long ciudadanoId) {
        return ListaResponse.de(domicilioService.listar(ciudadanoId));
    }

    @GetMapping("/domicilios/{id}")
    public DomicilioResponse obtener(@PathVariable Long id) {
        return domicilioService.obtener(id);
    }

    @PutMapping("/domicilios/{id}")

    public DomicilioResponse actualizar(@PathVariable Long id,
                                        @Valid @RequestBody ActualizarDomicilioRequest request) {
        return domicilioService.actualizar(id, request);
    }

    @PatchMapping("/domicilios/{id}/principal")
    public DomicilioPrincipalResponse marcarPrincipal(@PathVariable Long id) {
        return domicilioService.marcarPrincipal(id);
    }

    /** No borra: cierra la vigencia y devuelve la fecha de cierre. */
    @DeleteMapping("/domicilios/{id}")
    public DomicilioCerradoResponse darDeBaja(@PathVariable Long id) {
        return domicilioService.darDeBaja(id);
    }
}

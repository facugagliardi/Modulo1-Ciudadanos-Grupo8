package ar.edu.uade.ciudadanos.contacto;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.contacto.dto.ActualizarContactoRequest;
import ar.edu.uade.ciudadanos.contacto.dto.ContactoCreadoResponse;
import ar.edu.uade.ciudadanos.contacto.dto.ContactoResponse;
import ar.edu.uade.ciudadanos.contacto.dto.ContactoVerificadoResponse;
import ar.edu.uade.ciudadanos.contacto.dto.CrearContactoRequest;
import ar.edu.uade.ciudadanos.contacto.dto.VerificarContactoRequest;
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

/** Contactos de un ciudadano (RF-13, RF-14, RF-15). */
@RestController
public class ContactoController {

    private final ContactoService contactoService;

    public ContactoController(ContactoService contactoService) {
        this.contactoService = contactoService;
    }

    @PostMapping("/ciudadanos/{ciudadanoId}/contactos")
    public ResponseEntity<ContactoCreadoResponse> crear(@PathVariable Long ciudadanoId,
                                                        @Valid @RequestBody CrearContactoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(contactoService.crear(ciudadanoId, request));
    }

    @GetMapping("/ciudadanos/{ciudadanoId}/contactos")
    public ListaResponse<ContactoResponse> listar(@PathVariable Long ciudadanoId) {
        return ListaResponse.de(contactoService.listar(ciudadanoId));
    }

    @PutMapping("/contactos/{id}")
    public ContactoResponse actualizar(@PathVariable Long id,
                                       @Valid @RequestBody ActualizarContactoRequest request) {
        return contactoService.actualizar(id, request);
    }

    @DeleteMapping("/contactos/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        contactoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/contactos/{id}/verificar")
    public ContactoVerificadoResponse verificar(@PathVariable Long id,
                                                @Valid @RequestBody VerificarContactoRequest request) {
        return contactoService.verificar(id, request.codigo());
    }
}

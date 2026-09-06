package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.persona.dto.AgregarIntegranteRequest;
import ar.edu.uade.ciudadanos.persona.dto.PersonaJuridicaResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/personas-juridicas")
public class PersonaJuridicaController {

    private final PersonaJuridicaService personaJuridicaService;

    public PersonaJuridicaController(PersonaJuridicaService personaJuridicaService) {
        this.personaJuridicaService = personaJuridicaService;
    }

    @GetMapping("/{id}")
    public PersonaJuridicaResponse obtener(@PathVariable Long id) {
        return personaJuridicaService.obtener(id);
    }

    @PostMapping("/{id}/integrantes")
    public ResponseEntity<Void> agregarIntegrante(@PathVariable Long id,
                                                  @Valid @RequestBody AgregarIntegranteRequest request) {
        personaJuridicaService.agregarIntegrante(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{id}/integrantes/{ciudadanoId}")
    public ResponseEntity<Void> quitarIntegrante(@PathVariable Long id, @PathVariable Long ciudadanoId) {
        personaJuridicaService.quitarIntegrante(id, ciudadanoId);
        return ResponseEntity.noContent().build();
    }
}

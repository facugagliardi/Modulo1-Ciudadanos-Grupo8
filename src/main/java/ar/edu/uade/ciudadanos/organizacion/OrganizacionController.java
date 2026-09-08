package ar.edu.uade.ciudadanos.organizacion;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.ActualizarDuenoRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.ActualizarOrganizacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.AgregarDuenoRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.CambioEstadoOrganizacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.CrearOrganizacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.DuenoAgregadoResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.DuenoResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.ExistenciaOrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.OrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.OrganizacionResumenResponse;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Organizaciones y sus duenos (RF-02, RF-08, RF-19). */
@RestController
@RequestMapping("/organizaciones")
public class OrganizacionController {

    private final OrganizacionService organizacionService;

    public OrganizacionController(OrganizacionService organizacionService) {
        this.organizacionService = organizacionService;
    }

    @PostMapping
    public ResponseEntity<OrganizacionResponse> crear(@Valid @RequestBody CrearOrganizacionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(organizacionService.crear(request));
    }

    @GetMapping
    public ListaResponse<OrganizacionResumenResponse> listar() {
        return ListaResponse.de(organizacionService.listar());
    }

    /** RF-06. Ruta literal: matchea antes que /{id}. Nunca devuelve 404. */
    @GetMapping("/cuit/{cuit}")
    public ExistenciaOrganizacionResponse buscarPorCuit(@PathVariable String cuit) {
        return organizacionService.buscarPorCuit(cuit);
    }

    @GetMapping("/{id}")
    public OrganizacionResponse obtener(@PathVariable Long id) {
        return organizacionService.obtener(id);
    }

    @PutMapping("/{id}")
    public OrganizacionResponse actualizar(@PathVariable Long id,
                                           @Valid @RequestBody ActualizarOrganizacionRequest request) {
        return organizacionService.actualizar(id, request);
    }

    @PatchMapping("/{id}/estado")
    public CambioEstadoResponse cambiarEstado(@PathVariable Long id,
                                              @Valid @RequestBody CambioEstadoOrganizacionRequest request) {
        return organizacionService.cambiarEstado(id, request.estado());
    }

    @PostMapping("/{id}/duenos")
    public ResponseEntity<DuenoAgregadoResponse> agregarDueno(@PathVariable Long id,
                                                              @Valid @RequestBody AgregarDuenoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(organizacionService.agregarDueno(id, request));
    }

    @PutMapping("/{id}/duenos/{personaId}")
    public DuenoResponse actualizarDueno(@PathVariable Long id,
                                         @PathVariable Long personaId,
                                         @Valid @RequestBody ActualizarDuenoRequest request) {
        return organizacionService.actualizarDueno(id, personaId, request);
    }

    @GetMapping("/{id}/duenos")
    public ListaResponse<DuenoResponse> listarDuenos(@PathVariable Long id) {
        return ListaResponse.de(organizacionService.listarDuenos(id));
    }

    @DeleteMapping("/{id}/duenos/{personaId}")
    public ResponseEntity<Void> quitarDueno(@PathVariable Long id, @PathVariable Long personaId) {
        organizacionService.quitarDueno(id, personaId);
        return ResponseEntity.noContent().build();
    }
}

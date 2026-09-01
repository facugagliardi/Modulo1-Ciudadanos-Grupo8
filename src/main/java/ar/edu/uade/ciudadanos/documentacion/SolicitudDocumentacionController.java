package ar.edu.uade.ciudadanos.documentacion;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.CambioEstadoSolicitudRequest;
import ar.edu.uade.ciudadanos.documentacion.dto.CrearSolicitudRequest;
import ar.edu.uade.ciudadanos.documentacion.dto.SolicitudResponse;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Solicitudes de documentacion (RF-27, RF-28, RF-29). */
@RestController
@RequestMapping("/solicitudes-documentacion")
public class SolicitudDocumentacionController {

    private final SolicitudDocumentacionService solicitudService;

    public SolicitudDocumentacionController(SolicitudDocumentacionService solicitudService) {
        this.solicitudService = solicitudService;
    }

    @PostMapping
    public ResponseEntity<SolicitudResponse> crear(@Valid @RequestBody CrearSolicitudRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(solicitudService.crear(request));
    }

    @GetMapping
    public ListaResponse<SolicitudResponse> listar() {
        return ListaResponse.de(solicitudService.listar());
    }

    @GetMapping("/{id}")
    public SolicitudResponse obtener(@PathVariable Long id) {
        return solicitudService.obtener(id);
    }

    @PatchMapping("/{id}/estado")
    public CambioEstadoResponse cambiarEstado(@PathVariable Long id,
                                              @Valid @RequestBody CambioEstadoSolicitudRequest request) {
        return solicitudService.cambiarEstado(id, request);
    }
}

package ar.edu.uade.ciudadanos.mensajeria;

import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoint para disparar mensajes de prueba del laboratorio guiado. */
@RestController
@RequestMapping("/mensajeria/laboratorio/solicitudes-documentacion")
@ConditionalOnProperty(prefix = "app.mensajeria.p2p", name = "enabled", havingValue = "true")
public class LaboratorioP2PController {

    private final LaboratorioP2PService service;

    public LaboratorioP2PController(LaboratorioP2PService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<SolicitudDocumentacionMensaje> enviar(
            @Valid @RequestBody EnviarSolicitudDocumentacionRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(service.enviar(request));
    }
}

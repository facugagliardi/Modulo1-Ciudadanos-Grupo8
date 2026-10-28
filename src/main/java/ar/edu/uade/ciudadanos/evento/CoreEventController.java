package ar.edu.uade.ciudadanos.evento;

import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Entrada manual para pruebas internas; el transporte normal entre modulos es Core/RabbitMQ. */
@RestController
public class CoreEventController {
    private final CoreEventDispatcher dispatcher;

    public CoreEventController(CoreEventDispatcher dispatcher) { this.dispatcher = dispatcher; }

    @PostMapping("/eventos/core/recibir")
    @PreAuthorize("@permisos.puede('EDITAR_TERCEROS')")
    public Map<String, String> recibir(@RequestBody String json) {
        return Map.of("status", dispatcher.procesar(json));
    }
}

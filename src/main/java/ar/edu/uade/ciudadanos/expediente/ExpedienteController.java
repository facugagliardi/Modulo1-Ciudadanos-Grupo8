package ar.edu.uade.ciudadanos.expediente;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.expediente.dto.ActuacionResponse;
import ar.edu.uade.ciudadanos.expediente.dto.CambioEstadoExpedienteRequest;
import ar.edu.uade.ciudadanos.expediente.dto.CrearActuacionRequest;
import ar.edu.uade.ciudadanos.expediente.dto.CrearExpedienteRequest;
import ar.edu.uade.ciudadanos.expediente.dto.ExpedienteResponse;
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

/**
 * Expedientes y actuaciones (RF-30 a RF-35).
 *
 * <p>Los GET estan en la spec v2. Los POST y el PATCH de estado son INFERIDOS:
 * los RF existen pero la spec no documenta la ruta y la marca "a confirmar con
 * el equipo".
 */
@RestController
@RequestMapping("/expedientes")
public class ExpedienteController {

    private final ExpedienteService expedienteService;

    public ExpedienteController(ExpedienteService expedienteService) {
        this.expedienteService = expedienteService;
    }

    /** INFERIDO (RF-30, RF-31). */
    @PostMapping
    public ResponseEntity<ExpedienteResponse> crear(@Valid @RequestBody CrearExpedienteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(expedienteService.crear(request));
    }

    @GetMapping
    public ListaResponse<ExpedienteResponse> listar() {
        return ListaResponse.de(expedienteService.listar());
    }

    @GetMapping("/{id}")
    public ExpedienteResponse obtener(@PathVariable Long id) {
        return expedienteService.obtener(id);
    }

    /** INFERIDO (RF-32). */
    @PatchMapping("/{id}/estado")
    public CambioEstadoResponse cambiarEstado(@PathVariable Long id,
                                              @Valid @RequestBody CambioEstadoExpedienteRequest request) {
        return expedienteService.cambiarEstado(id, request.estado());
    }

    /** INFERIDO (RF-33, RF-34). */
    @PostMapping("/{id}/actuaciones")
    public ResponseEntity<ActuacionResponse> agregarActuacion(@PathVariable Long id,
                                                              @Valid @RequestBody CrearActuacionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(expedienteService.agregarActuacion(id, request));
    }

    /** RF-35: historial completo. */
    @GetMapping("/{id}/actuaciones")
    public ListaResponse<ActuacionResponse> listarActuaciones(@PathVariable Long id) {
        return ListaResponse.de(expedienteService.listarActuaciones(id));
    }
}

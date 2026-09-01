package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.persona.dto.ActualizarCiudadanoRequest;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoCiudadanoRequest;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.persona.dto.CiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.dto.CiudadanoResumenResponse;
import ar.edu.uade.ciudadanos.persona.dto.ExistenciaCiudadanoResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Ciudadanos (RF-04 a RF-07). El alta ocurre en POST /auth/register. */
@RestController
@RequestMapping("/ciudadanos")
public class CiudadanoController {

    private final CiudadanoService ciudadanoService;

    public CiudadanoController(CiudadanoService ciudadanoService) {
        this.ciudadanoService = ciudadanoService;
    }

    /** Listado completo: el filtrado y el paginado son del front (spec v2). */
    @GetMapping
    public ListaResponse<CiudadanoResumenResponse> listar() {
        return ListaResponse.de(ciudadanoService.listar());
    }

    /**
     * RF-06. Ruta literal, va antes que /{id} en el matching de Spring.
     * Nunca devuelve 404: si no hay ciudadano responde {existe:false}.
     */
    @GetMapping("/dni/{dni}")
    public ExistenciaCiudadanoResponse buscarPorDni(@PathVariable String dni) {
        return ciudadanoService.buscarPorDni(dni);
    }

    /** Igual que el anterior, pero con el DNI como query param (inter-modulo). */
    @GetMapping("/existe")
    public ExistenciaCiudadanoResponse existe(@RequestParam String dni) {
        return ciudadanoService.buscarPorDni(dni);
    }

    @GetMapping("/{id}")
    public CiudadanoResponse obtener(@PathVariable Long id) {
        return ciudadanoService.obtener(id);
    }

    @PutMapping("/{id}")
    public CiudadanoResponse actualizar(@PathVariable Long id,
                                        @Valid @RequestBody ActualizarCiudadanoRequest request) {
        return ciudadanoService.actualizar(id, request);
    }

    @PatchMapping("/{id}/estado")
    public CambioEstadoResponse cambiarEstado(@PathVariable Long id,
                                              @Valid @RequestBody CambioEstadoCiudadanoRequest request) {
        return ciudadanoService.cambiarEstado(id, request.estado());
    }
}

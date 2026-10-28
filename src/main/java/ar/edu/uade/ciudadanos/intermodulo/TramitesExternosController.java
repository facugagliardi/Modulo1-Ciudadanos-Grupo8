package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TramitesExternosController {
    private final TramitesExternosService service;

    public TramitesExternosController(TramitesExternosService service) { this.service = service; }

    @GetMapping("/ciudadanos/{id}/tramites-externos")
    public ListaResponse<TramitesExternosService.Tramite> listar(@PathVariable Long id) {
        return ListaResponse.de(service.listar(id));
    }
}

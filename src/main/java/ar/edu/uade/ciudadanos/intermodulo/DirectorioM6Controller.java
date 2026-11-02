package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.security.SoloInterno;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** API de lectura por identificadores publicos, independiente del padron interno. */
@RestController
@RequestMapping("/integraciones/v1")
@SoloInterno
public class DirectorioM6Controller {
    private final DirectorioM6Service directorio;

    public DirectorioM6Controller(DirectorioM6Service directorio) {
        this.directorio = directorio;
    }

    @GetMapping("/ciudadanos/{citizenId}")
    public DirectorioM6Service.CiudadanoInfo ciudadano(@PathVariable UUID citizenId) {
        return directorio.ciudadano(citizenId);
    }

    @GetMapping("/organizaciones/{organizationId}")
    public DirectorioM6Service.OrganizacionInfo organizacion(@PathVariable UUID organizationId) {
        return directorio.organizacion(organizationId);
    }

    @GetMapping("/organizaciones")
    public DirectorioM6Service.OrganizacionInfo organizacionPorCuit(@RequestParam String cuit) {
        return directorio.organizacionPorCuit(cuit);
    }

    @GetMapping("/actores")
    public DirectorioM6Service.ActorInfo actor(@RequestParam String actorType, @RequestParam Long sub) {
        return directorio.actor(actorType, sub);
    }
}

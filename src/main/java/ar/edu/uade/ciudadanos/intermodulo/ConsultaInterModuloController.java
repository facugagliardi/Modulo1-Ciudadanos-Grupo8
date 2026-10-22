package ar.edu.uade.ciudadanos.intermodulo;

import ar.edu.uade.ciudadanos.domicilio.DomicilioService;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioPrincipalInterModuloResponse;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import ar.edu.uade.ciudadanos.evento.dto.CitizenInfoDeliveredData;
import ar.edu.uade.ciudadanos.evento.dto.OrganizationInfoDeliveredData;
import ar.edu.uade.ciudadanos.organizacion.OrganizacionService;
import ar.edu.uade.ciudadanos.organizacion.dto.IdentidadOrganizacionResponse;
import ar.edu.uade.ciudadanos.persona.CiudadanoService;
import ar.edu.uade.ciudadanos.persona.dto.EstadoCiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.dto.IdentidadCiudadanoResponse;
import ar.edu.uade.ciudadanos.security.SoloInterno;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Consultas que hacen los otros modulos (marcadas {@code Svc} en la spec).
 * Emite de forma automatica eventos citizenInfoDelivered y organizationInfoDelivered.
 */
@RestController
@SoloInterno
public class ConsultaInterModuloController {

    private final CiudadanoService ciudadanoService;
    private final OrganizacionService organizacionService;
    private final DomicilioService domicilioService;
    private final EventPublisherService eventPublisherService;

    public ConsultaInterModuloController(CiudadanoService ciudadanoService,
                                         OrganizacionService organizacionService,
                                         DomicilioService domicilioService) {
        this(ciudadanoService, organizacionService, domicilioService, null);
    }

    public ConsultaInterModuloController(CiudadanoService ciudadanoService,
                                         OrganizacionService organizacionService,
                                         DomicilioService domicilioService,
                                         EventPublisherService eventPublisherService) {
        this.ciudadanoService = ciudadanoService;
        this.organizacionService = organizacionService;
        this.domicilioService = domicilioService;
        this.eventPublisherService = eventPublisherService;
    }

    @GetMapping("/ciudadanos/{id}/identidad")
    public IdentidadCiudadanoResponse identidadCiudadano(@PathVariable Long id,
                                                         @RequestHeader(value = "X-Correlation-Id", required = false) String correlationIdHeader,
                                                         @RequestParam(value = "correlationId", required = false) String correlationIdParam) {
        IdentidadCiudadanoResponse identidad = ciudadanoService.identidad(id);
        String correlationId = correlationIdHeader != null ? correlationIdHeader : correlationIdParam;
        if (eventPublisherService != null) {
            try {
                String corrId = correlationId != null ? correlationId : "M6-REQ-" + UUID.randomUUID().toString().substring(0, 8);
                Map<String, Object> addressMap = Map.of();
                try {
                    var dom = domicilioService.domicilioPrincipal(id);
                    if (dom != null) {
                        addressMap = Map.of(
                                "street", dom.calle(),
                                "number", dom.numero(),
                                "neighborhoodId", dom.idBarrio() != null ? dom.idBarrio().toString() : ""
                        );
                    }
                } catch (Exception ignored) {
                }

                CitizenInfoDeliveredData data = new CitizenInfoDeliveredData(
                        id,
                        identidad.nombre() + " " + identidad.apellido(),
                        identidad.dni(),
                        "",
                        "",
                        addressMap
                );
                eventPublisherService.publicarCitizenInfoDelivered(id, corrId, data);
            } catch (Exception ignored) {
            }
        }
        return identidad;
    }

    @GetMapping("/ciudadanos/{id}/estado")
    public EstadoCiudadanoResponse estadoCiudadano(@PathVariable Long id) {
        return ciudadanoService.estado(id);
    }

    @GetMapping("/organizaciones/{id}/identidad")
    public IdentidadOrganizacionResponse identidadOrganizacion(@PathVariable Long id,
                                                               @RequestHeader(value = "X-Correlation-Id", required = false) String correlationIdHeader,
                                                               @RequestParam(value = "correlationId", required = false) String correlationIdParam) {
        IdentidadOrganizacionResponse identidad = organizacionService.identidad(id);
        String correlationId = correlationIdHeader != null ? correlationIdHeader : correlationIdParam;
        if (eventPublisherService != null) {
            try {
                String corrId = correlationId != null ? correlationId : "M6-REQ-" + UUID.randomUUID().toString().substring(0, 8);
                Long cuitNum = Long.parseLong(identidad.cuit().replaceAll("\\D", ""));
                OrganizationInfoDeliveredData data = new OrganizationInfoDeliveredData(
                        id,
                        cuitNum,
                        identidad.razonSocial(),
                        identidad.razonSocial(),
                        identidad.cuit(),
                        identidad.estado() != null ? identidad.estado().name() : "ACTIVA"
                );
                eventPublisherService.publicarOrganizationInfoDelivered(id, corrId, data);
            } catch (Exception ignored) {
            }
        }
        return identidad;
    }

    @GetMapping("/personas/{id}/domicilio-principal")
    public DomicilioPrincipalInterModuloResponse domicilioPrincipal(@PathVariable Long id) {
        return domicilioService.domicilioPrincipal(id);
    }
}

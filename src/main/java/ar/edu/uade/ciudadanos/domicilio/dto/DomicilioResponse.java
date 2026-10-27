package ar.edu.uade.ciudadanos.domicilio.dto;

import ar.edu.uade.ciudadanos.domicilio.entity.CiudadanoPropiedad;
import ar.edu.uade.ciudadanos.domicilio.entity.Propiedad;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.util.UUID;

/** Domicilio con su vigencia. Item de GET /ciudadanos/{id}/domicilios (RF-11). */
public record DomicilioResponse(
        Long propiedadId,
        String tipo,
        String calle,
        String numero,
        String piso,
        UUID idBarrio,
        String longitud,
        String latitud,
        boolean esPrincipal,
        LocalDate vigenteDesde,
        LocalDate vigenteHasta) {

    public static DomicilioResponse de(Propiedad p, CiudadanoPropiedad vinculo) {
        return new DomicilioResponse(p.getPropiedadId(), p.getTipo(), p.getCalle(), p.getNumero(), p.getPiso(),
                p.getIdBarrio(), p.getLongitud(), p.getLatitud(),
                vinculo.isEsPrincipal(), vinculo.getVigenteDesde(), vinculo.getVigenteHasta());
    }

    @JsonProperty("altura")
    public String altura() {
        return piso;
    }
}

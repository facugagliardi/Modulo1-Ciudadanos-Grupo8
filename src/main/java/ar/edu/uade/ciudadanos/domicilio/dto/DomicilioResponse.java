package ar.edu.uade.ciudadanos.domicilio.dto;

import ar.edu.uade.ciudadanos.domicilio.entity.PersonaPropiedad;
import ar.edu.uade.ciudadanos.domicilio.entity.Propiedad;
import java.time.LocalDate;
import java.util.UUID;

/** Domicilio con su vigencia. Item de GET /personas/{id}/domicilios (RF-11). */
public record DomicilioResponse(
        Long propiedadId,
        String tipo,
        String calle,
        String numero,
        String altura,
        UUID idBarrio,
        String longitud,
        String latitud,
        boolean esPrincipal,
        LocalDate vigenteDesde,
        LocalDate vigenteHasta) {

    public static DomicilioResponse de(Propiedad p, PersonaPropiedad vinculo) {
        return new DomicilioResponse(p.getPropiedadId(), p.getTipo(), p.getCalle(), p.getNumero(), p.getAltura(),
                p.getIdBarrio(), p.getLongitud(), p.getLatitud(),
                vinculo.isEsPrincipal(), vinculo.getVigenteDesde(), vinculo.getVigenteHasta());
    }
}

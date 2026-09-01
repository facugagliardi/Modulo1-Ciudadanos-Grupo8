package ar.edu.uade.ciudadanos.contacto.dto;

import ar.edu.uade.ciudadanos.contacto.entity.ContactoCiudadano;
import ar.edu.uade.ciudadanos.contacto.entity.TipoContacto;

/** Item de GET /ciudadanos/{id}/contactos y cuerpo de PUT /contactos/{id}. */
public record ContactoResponse(Long contactoId, TipoContacto tipo, String valor, boolean verificado) {

    public static ContactoResponse de(ContactoCiudadano c) {
        return new ContactoResponse(c.getContactoId(), c.getTipo(), c.getValor(), c.isVerificado());
    }
}

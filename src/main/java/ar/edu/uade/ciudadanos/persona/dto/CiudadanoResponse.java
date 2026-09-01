package ar.edu.uade.ciudadanos.persona.dto;

import ar.edu.uade.ciudadanos.contacto.dto.ContactoResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioResponse;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.time.LocalDate;
import java.util.List;

/** 200 de GET /ciudadanos/{id} y de PUT /ciudadanos/{id}. */
public record CiudadanoResponse(
        Long id,
        String dni,
        String nombre,
        String apellido,
        LocalDate fechaNacimiento,
        String cuil,
        EstadoCiudadano estado,
        /** null si todavia no cargo ningun domicilio. */
        DomicilioResponse domicilioPrincipal,
        List<ContactoResponse> contactos) {
}

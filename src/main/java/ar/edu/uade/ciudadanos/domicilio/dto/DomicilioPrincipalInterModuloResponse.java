package ar.edu.uade.ciudadanos.domicilio.dto;

import java.util.UUID;

/** GET /personas/{id}/domicilio-principal (consulta inter-modulo). */
public record DomicilioPrincipalInterModuloResponse(
        Long propiedadId, String calle, String numero, UUID idBarrio, String longitud, String latitud) {
}

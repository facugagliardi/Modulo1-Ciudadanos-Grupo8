package ar.edu.uade.ciudadanos.persona.dto;

import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.UUID;

/** GET /ciudadanos/{id}/identidad (consulta inter-modulo). */
public record IdentidadCiudadanoResponse(
        Long id, String dni, String nombre, String apellido, EstadoCiudadano estado, UUID uuid) {

    public IdentidadCiudadanoResponse(Long id, String dni, String nombre, String apellido, EstadoCiudadano estado) {
        this(id, dni, nombre, apellido, estado, null);
    }
}

package ar.edu.uade.ciudadanos.organizacion.dto;

import java.math.BigDecimal;

/**
 * Item de GET /organizaciones/{id}/duenos.
 * Si el dueno es una persona juridica, {@code dni} y {@code apellido} van en
 * null y {@code nombre} trae la razon social.
 */
public record DuenoResponse(
        Long personaId, String dni, String nombre, String apellido, BigDecimal porcentajeTitularidad) {
}

package ar.edu.uade.ciudadanos.persona.dto;

/**
 * Datos identificatorios de una persona, sirva o no de tipo fisica.
 *
 * <p>Para una juridica no hay DNI ni apellido: {@code nombre} trae la razon
 * social y los otros dos vienen en null.
 */
public record DatosPersona(Long personaId, String dni, String nombre, String apellido, String cuit) {
}

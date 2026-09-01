package ar.edu.uade.ciudadanos.security;

/**
 * Sujeto autenticado, reconstruido desde el JWT en cada request.
 *
 * @param id       personaId o empleadoId segun {@code tipo}
 * @param tipoInfo contra que tabla se autentico
 * @param rol      nombre de un {@link Rol}: PERSONA para ciudadanos y juridicas,
 *                 el rol del empleado si es interno, o SERVICIO
 */
public record AuthPrincipal(Long id, TipoSujeto tipoInfo, String rol) {
}

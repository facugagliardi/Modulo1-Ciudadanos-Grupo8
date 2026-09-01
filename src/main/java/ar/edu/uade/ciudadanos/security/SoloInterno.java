package ar.edu.uade.ciudadanos.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Endpoints marcados {@code Svc} en la spec: consultas inter-modulo.
 *
 * <p>Delega en {@link AutorizacionService} en vez de enumerar roles, para que
 * {@link Rol} siga siendo la unica fuente de verdad: si manana un rol nuevo
 * necesita estas consultas, se le agrega {@link Permiso#CONSULTA_INTERMODULO} y
 * esta anotacion no se toca.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@PreAuthorize("@permisos.puede('CONSULTA_INTERMODULO')")
public @interface SoloInterno {
}

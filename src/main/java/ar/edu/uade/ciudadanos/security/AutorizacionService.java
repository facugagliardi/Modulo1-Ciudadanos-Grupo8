package ar.edu.uade.ciudadanos.security;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.organizacion.entity.PersonaOrganizacionId;
import ar.edu.uade.ciudadanos.organizacion.repository.PersonaOrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Quien puede que. Dos reglas, y ninguna menciona un rol concreto:
 *
 * <ol>
 *   <li><b>Sobre lo propio</b> no hace falta permiso: cada titular administra
 *       sus datos, y sobre una organizacion tambien su dueno y su representante
 *       vigente (RF-22).
 *   <li><b>Sobre lo ajeno</b> hace falta el {@link Permiso} correspondiente,
 *       que sale del {@link Rol} que viaja en el token.
 * </ol>
 *
 * <p>Se expone como bean {@code permisos} para poder usarlo desde SpEL en
 * {@code @PreAuthorize} sin volver a enumerar roles en las anotaciones.
 */
@Service("permisos")
public class AutorizacionService {

    private final PersonaOrganizacionRepository personaOrganizacionRepository;
    private final RepresentacionRepository representacionRepository;

    public AutorizacionService(PersonaOrganizacionRepository personaOrganizacionRepository,
                               RepresentacionRepository representacionRepository) {
        this.personaOrganizacionRepository = personaOrganizacionRepository;
        this.representacionRepository = representacionRepository;
    }

    // ------------------------------------------------------------- quien llama

    /** @throws ApiException 401 si no hay nadie autenticado */
    public AuthPrincipal actual() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthPrincipal principal)) {
            throw ApiException.noAutenticado("Token ausente o invalido");
        }
        return principal;
    }

    /** Vacio si el token trae un rol que ya no existe: entonces no autoriza nada. */
    public Optional<Rol> rolActual() {
        return Rol.porNombre(actual().rol());
    }

    // ----------------------------------------------------------------- permisos

    public boolean puede(Permiso permiso) {
        return rolActual().map(rol -> rol.tiene(permiso)).orElse(false);
    }

    /** Sobrecarga para {@code @PreAuthorize("@permisos.puede('...')")}. */
    public boolean puede(String permiso) {
        try {
            return puede(Permiso.valueOf(permiso));
        } catch (IllegalArgumentException permisoInexistente) {
            return false;
        }
    }

    public void exigir(Permiso permiso, String operacion) {
        if (!puede(permiso)) {
            throw ApiException.prohibido(
                    "Tu rol (" + actual().rol() + ") no tiene permiso para " + operacion
                            + ". Requiere: " + permiso);
        }
    }

    // ------------------------------------------------------------------ personas

    /** Ver datos de una persona: los propios siempre, los ajenos con permiso. */
    public void exigirLecturaDePersona(Long personaId) {
        if (esPropia(personaId) || puede(Permiso.LEER_TERCEROS)) {
            return;
        }
        throw ApiException.prohibido("No tenes permiso para ver los datos de esa persona");
    }

    /** Modificar datos de una persona: los propios siempre, los ajenos con permiso. */
    public void exigirEscrituraSobrePersona(Long personaId) {
        if (esPropia(personaId) || puede(Permiso.EDITAR_TERCEROS)) {
            return;
        }
        throw ApiException.prohibido("No tenes permiso para modificar los datos de esa persona");
    }

    private boolean esPropia(Long personaId) {
        return actual().id().equals(personaId);
    }

    // ------------------------------------------------------------ organizaciones

    /**
     * Modificar una organizacion: sus duenos y representantes vigentes, o quien
     * tenga permiso sobre datos de terceros.
     */
    public void exigirEscrituraSobreOrganizacion(Long organizacionId) {
        if (vinculadoALaOrganizacion(organizacionId) || puede(Permiso.EDITAR_TERCEROS)) {
            return;
        }
        throw ApiException.prohibido(
                "Solo un dueno o un representante vigente puede operar en nombre de la organizacion");
    }

    /** Otorgar o revocar poderes: mas restringido que editar datos (RF-20, RF-21). */
    public void exigirGestionDeRepresentaciones(Long organizacionId) {
        if (vinculadoALaOrganizacion(organizacionId) || puede(Permiso.GESTIONAR_REPRESENTACIONES)) {
            return;
        }
        throw ApiException.prohibido(
                "Solo un dueno, un representante vigente o un empleado habilitado puede administrar "
                        + "las representaciones de la organizacion");
    }

    private boolean vinculadoALaOrganizacion(Long organizacionId) {
        Long propio = actual().id();
        boolean esDueno = personaOrganizacionRepository
                .existsById(new PersonaOrganizacionId(propio, organizacionId));
        return esDueno || representacionRepository
                .findVigente(propio, organizacionId, LocalDate.now()).isPresent();
    }

    // ------------------------------------------------------------------ auditoria

    /**
     * Identificacion del actor para {@code cargadoPor} y {@code validadoPor}.
     * Incluye el rol para que la traza diga con que atribuciones se actuo.
     */
    public String actorActual() {
        AuthPrincipal principal = actual();
        return principal.tipoInfo() + ":" + principal.id() + ":" + principal.rol();
    }
}

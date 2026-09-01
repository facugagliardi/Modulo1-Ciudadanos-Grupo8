package ar.edu.uade.ciudadanos.domicilio;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.domicilio.dto.ActualizarDomicilioRequest;
import ar.edu.uade.ciudadanos.domicilio.dto.CrearDomicilioRequest;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioCerradoResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioCreadoResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioPrincipalInterModuloResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioPrincipalResponse;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioResponse;
import ar.edu.uade.ciudadanos.domicilio.entity.PersonaPropiedad;
import ar.edu.uade.ciudadanos.domicilio.entity.PersonaPropiedadId;
import ar.edu.uade.ciudadanos.domicilio.entity.Propiedad;
import ar.edu.uade.ciudadanos.domicilio.repository.PersonaPropiedadRepository;
import ar.edu.uade.ciudadanos.domicilio.repository.PropiedadRepository;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.PersonaRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Domicilios y su historial (RF-09 a RF-12).
 *
 * <p>Regla central: un domicilio nunca se borra. La baja cierra
 * {@code vigenteHasta} y la fila queda como historia.
 */
@Service
public class DomicilioService {

    private final PropiedadRepository propiedadRepository;
    private final PersonaPropiedadRepository vinculoRepository;
    private final PersonaRepository personaRepository;
    private final CiudadanoRepository ciudadanoRepository;
    private final AutorizacionService autorizacion;

    public DomicilioService(PropiedadRepository propiedadRepository,
                            PersonaPropiedadRepository vinculoRepository,
                            PersonaRepository personaRepository,
                            CiudadanoRepository ciudadanoRepository,
                            AutorizacionService autorizacion) {
        this.propiedadRepository = propiedadRepository;
        this.vinculoRepository = vinculoRepository;
        this.personaRepository = personaRepository;
        this.ciudadanoRepository = ciudadanoRepository;
        this.autorizacion = autorizacion;
    }

    @Transactional
    public DomicilioCreadoResponse crear(Long personaId, CrearDomicilioRequest request) {
        exigirPersona(personaId);
        autorizacion.exigirEscrituraSobrePersona(personaId);

        Propiedad propiedad = new Propiedad();
        aplicar(propiedad, ListasBlancas.exigir(request.tipo(), ListasBlancas.TIPOS_PROPIEDAD, "tipo"),
                request.calle(), request.numero(), request.altura(), request.idBarrio(),
                request.longitud(), request.latitud());
        propiedadRepository.save(propiedad);

        // Si todavia no hay principal vigente, este lo es: nadie deberia quedar
        // sin domicilio principal por haber omitido el flag.
        boolean sinPrincipal = vinculoRepository
                .findByIdIdPersonaAndEsPrincipalTrueAndVigenteHastaIsNull(personaId).isEmpty();
        boolean principal = Boolean.TRUE.equals(request.esPrincipal()) || sinPrincipal;

        if (principal) {
            desmarcarPrincipalVigente(personaId);
        }

        PersonaPropiedad vinculo = new PersonaPropiedad();
        vinculo.setId(new PersonaPropiedadId(personaId, propiedad.getPropiedadId()));
        vinculo.setVigenteDesde(LocalDate.now());
        vinculo.setEsPrincipal(principal);
        vinculoRepository.save(vinculo);

        if (principal) {
            sincronizarPunteroCiudadano(personaId, propiedad.getPropiedadId());
        }

        return new DomicilioCreadoResponse(propiedad.getPropiedadId(), personaId, propiedad.getTipo(),
                propiedad.getCalle(), propiedad.getNumero(), propiedad.getIdBarrio(),
                vinculo.getVigenteDesde(), principal);
    }

    /** RF-11: devuelve tambien los cerrados, que son el historial. */
    @Transactional(readOnly = true)
    public List<DomicilioResponse> listar(Long personaId) {
        exigirPersona(personaId);
        autorizacion.exigirLecturaDePersona(personaId);

        return vinculoRepository.findByIdIdPersona(personaId).stream()
                .map(v -> DomicilioResponse.de(propiedad(v.getId().getIdPropiedad()), v))
                .sorted(Comparator.comparing(DomicilioResponse::vigenteDesde).reversed())
                .toList();
    }

    @Transactional
    public DomicilioResponse actualizar(Long propiedadId, ActualizarDomicilioRequest request) {
        Propiedad propiedad = propiedad(propiedadId);
        PersonaPropiedad vinculo = vinculoOperable(propiedadId);

        aplicar(propiedad, ListasBlancas.exigir(request.tipo(), ListasBlancas.TIPOS_PROPIEDAD, "tipo"),
                request.calle(), request.numero(), request.altura(), request.idBarrio(),
                request.longitud(), request.latitud());

        return DomicilioResponse.de(propiedad, vinculo);
    }

    /** RF-10 y RF-12. */
    @Transactional
    public DomicilioPrincipalResponse marcarPrincipal(Long propiedadId) {
        PersonaPropiedad vinculo = vinculoOperable(propiedadId);
        Long personaId = vinculo.getId().getIdPersona();

        if (vinculo.getVigenteHasta() != null) {
            throw ApiException.conflicto("No se puede marcar como principal un domicilio dado de baja");
        }
        if (vinculo.isEsPrincipal()) {
            throw ApiException.conflicto("El domicilio ya es el principal");
        }

        desmarcarPrincipalVigente(personaId);
        vinculo.setEsPrincipal(true);
        sincronizarPunteroCiudadano(personaId, propiedadId);

        return new DomicilioPrincipalResponse(propiedadId, personaId, true, OffsetDateTime.now());
    }

    /**
     * RF-11: cierra la vigencia en lugar de borrar. Si el domicilio era el
     * principal, el mas reciente de los que quedan vigentes lo reemplaza; si no
     * queda ninguno, la baja se rechaza con 409.
     */
    @Transactional
    public DomicilioCerradoResponse darDeBaja(Long propiedadId) {
        PersonaPropiedad vinculo = vinculoOperable(propiedadId);
        Long personaId = vinculo.getId().getIdPersona();

        if (vinculo.getVigenteHasta() != null) {
            throw ApiException.conflicto("El domicilio ya estaba dado de baja");
        }

        Optional<PersonaPropiedad> reemplazo = vinculoRepository
                .findByIdIdPersonaAndVigenteHastaIsNull(personaId).stream()
                .filter(v -> !v.getId().getIdPropiedad().equals(propiedadId))
                .max(Comparator.comparing(PersonaPropiedad::getVigenteDesde));

        if (vinculo.isEsPrincipal() && reemplazo.isEmpty()) {
            throw ApiException.conflicto(
                    "Es el unico domicilio principal vigente: cargue otro domicilio antes de darlo de baja");
        }

        vinculo.setVigenteHasta(LocalDate.now());
        Long nuevoPrincipal = null;
        if (vinculo.isEsPrincipal()) {
            vinculo.setEsPrincipal(false);
            PersonaPropiedad sucesor = reemplazo.get();
            sucesor.setEsPrincipal(true);
            nuevoPrincipal = sucesor.getId().getIdPropiedad();
            sincronizarPunteroCiudadano(personaId, nuevoPrincipal);
        }

        return new DomicilioCerradoResponse(propiedadId, vinculo.getVigenteHasta(), nuevoPrincipal);
    }

    /** Consulta inter-modulo: 404 si la persona no tiene domicilio principal vigente. */
    @Transactional(readOnly = true)
    public DomicilioPrincipalInterModuloResponse domicilioPrincipal(Long personaId) {
        exigirPersona(personaId);
        PersonaPropiedad vinculo = vinculoRepository
                .findByIdIdPersonaAndEsPrincipalTrueAndVigenteHastaIsNull(personaId)
                .orElseThrow(() -> ApiException.noEncontrado("La persona no tiene domicilio principal vigente"));

        Propiedad p = propiedad(vinculo.getId().getIdPropiedad());
        return new DomicilioPrincipalInterModuloResponse(p.getPropiedadId(), p.getCalle(), p.getNumero(),
                p.getIdBarrio(), p.getLongitud(), p.getLatitud());
    }

    /** Resumen del domicilio principal, para embeber en otras respuestas. */
    @Transactional(readOnly = true)
    public Optional<DomicilioResponse> principalDe(Long personaId) {
        return vinculoRepository.findByIdIdPersonaAndEsPrincipalTrueAndVigenteHastaIsNull(personaId)
                .map(v -> DomicilioResponse.de(propiedad(v.getId().getIdPropiedad()), v));
    }

    // ------------------------------------------------------------------ helpers

    private void aplicar(Propiedad propiedad, String tipo, String calle, String numero, String altura,
                         java.util.UUID idBarrio, String longitud, String latitud) {
        propiedad.setTipo(tipo);
        propiedad.setCalle(calle.trim());
        propiedad.setNumero(numero.trim());
        propiedad.setAltura(altura);
        propiedad.setIdBarrio(idBarrio);
        propiedad.setLongitud(longitud);
        propiedad.setLatitud(latitud);
    }

    private void desmarcarPrincipalVigente(Long personaId) {
        vinculoRepository.findByIdIdPersonaAndEsPrincipalTrueAndVigenteHastaIsNull(personaId)
                .ifPresent(actual -> actual.setEsPrincipal(false));
        // El indice parcial uk_pp_principal_vigente no tolera dos principales a
        // la vez, asi que hay que bajar el anterior antes de subir el nuevo.
        vinculoRepository.flush();
    }

    /** Mantiene sincronizado el puntero denormalizado ciudadano.domicilio_id. */
    private void sincronizarPunteroCiudadano(Long personaId, Long propiedadId) {
        ciudadanoRepository.findById(personaId).ifPresent(c -> c.setDomicilioId(propiedadId));
    }

    private Propiedad propiedad(Long propiedadId) {
        return propiedadRepository.findById(propiedadId)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el domicilio " + propiedadId));
    }

    private void exigirPersona(Long personaId) {
        if (!personaRepository.existsById(personaId)) {
            throw ApiException.noEncontrado("No existe la persona " + personaId);
        }
    }

    /**
     * Los endpoints /domicilios/{id} no traen personaId, asi que hay que
     * deducir sobre que vinculo se opera: el del propio usuario, o el unico que
     * exista si quien llama es interno.
     */
    private PersonaPropiedad vinculoOperable(Long propiedadId) {
        List<PersonaPropiedad> vinculos = vinculoRepository.findByIdIdPropiedad(propiedadId);
        if (vinculos.isEmpty()) {
            throw ApiException.noEncontrado("No existe el domicilio " + propiedadId);
        }

        // Las tres operaciones que pasan por aca son escrituras.
        if (!autorizacion.puede(Permiso.EDITAR_TERCEROS)) {
            Long propio = autorizacion.actual().id();
            return vinculos.stream()
                    .filter(v -> v.getId().getIdPersona().equals(propio))
                    .findFirst()
                    .orElseThrow(() -> ApiException.prohibido("El domicilio no pertenece a tu persona"));
        }

        if (vinculos.size() > 1) {
            throw ApiException.conflicto(
                    "El domicilio esta asociado a varias personas: la operacion es ambigua sobre esta ruta");
        }
        return vinculos.get(0);
    }
}

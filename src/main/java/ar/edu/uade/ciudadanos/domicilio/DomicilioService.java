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
import ar.edu.uade.ciudadanos.domicilio.entity.CiudadanoPropiedad;
import ar.edu.uade.ciudadanos.domicilio.entity.CiudadanoPropiedadId;
import ar.edu.uade.ciudadanos.domicilio.entity.Propiedad;
import ar.edu.uade.ciudadanos.domicilio.repository.CiudadanoPropiedadRepository;
import ar.edu.uade.ciudadanos.domicilio.repository.PropiedadRepository;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
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
    private final CiudadanoPropiedadRepository vinculoRepository;
    private final CiudadanoRepository ciudadanoRepository;
    private final AutorizacionService autorizacion;

    public DomicilioService(PropiedadRepository propiedadRepository,
                            CiudadanoPropiedadRepository vinculoRepository,
                            CiudadanoRepository ciudadanoRepository,
                            AutorizacionService autorizacion) {
        this.propiedadRepository = propiedadRepository;
        this.vinculoRepository = vinculoRepository;
        this.ciudadanoRepository = ciudadanoRepository;
        this.autorizacion = autorizacion;
    }

    @Transactional
    public DomicilioCreadoResponse crear(Long ciudadanoId, CrearDomicilioRequest request) {
        exigirCiudadano(ciudadanoId);
        autorizacion.exigirEscrituraSobrePersona(ciudadanoId);

        Propiedad propiedad = new Propiedad();
        aplicar(propiedad, ListasBlancas.exigir(request.tipo(), ListasBlancas.TIPOS_PROPIEDAD, "tipo"),
                request.calle(), request.numero(), request.altura(), request.idBarrio(),
                request.longitud(), request.latitud());
        propiedadRepository.save(propiedad);

        // Si todavia no hay principal vigente, este lo es: nadie deberia quedar
        // sin domicilio principal por haber omitido el flag.
        boolean sinPrincipal = vinculoRepository
                .findByIdIdCiudadanoAndEsPrincipalTrueAndVigenteHastaIsNull(ciudadanoId).isEmpty();
        boolean principal = Boolean.TRUE.equals(request.esPrincipal()) || sinPrincipal;

        if (principal) {
            desmarcarPrincipalVigente(ciudadanoId);
        }

        CiudadanoPropiedad vinculo = new CiudadanoPropiedad();
        vinculo.setId(new CiudadanoPropiedadId(ciudadanoId, propiedad.getPropiedadId()));
        vinculo.setVigenteDesde(LocalDate.now());
        vinculo.setEsPrincipal(principal);
        vinculoRepository.save(vinculo);


        return new DomicilioCreadoResponse(propiedad.getPropiedadId(), ciudadanoId, propiedad.getTipo(),
                propiedad.getCalle(), propiedad.getNumero(), propiedad.getIdBarrio(),
                vinculo.getVigenteDesde(), principal);
    }

    /** RF-11: devuelve tambien los cerrados, que son el historial. */
    @Transactional(readOnly = true)
    public List<DomicilioResponse> listar(Long ciudadanoId) {
        exigirCiudadano(ciudadanoId);
        autorizacion.exigirLecturaDePersona(ciudadanoId);

        return vinculoRepository.findByIdIdCiudadano(ciudadanoId).stream()
                .map(v -> DomicilioResponse.de(propiedad(v.getId().getIdPropiedad()), v))
                .sorted(Comparator.comparing(DomicilioResponse::vigenteDesde).reversed())
                .toList();
    }

    @Transactional
    public DomicilioResponse actualizar(Long propiedadId, ActualizarDomicilioRequest request) {
        Propiedad propiedad = propiedad(propiedadId);
        CiudadanoPropiedad vinculo = vinculoOperable(propiedadId);

        aplicar(propiedad, ListasBlancas.exigir(request.tipo(), ListasBlancas.TIPOS_PROPIEDAD, "tipo"),
                request.calle(), request.numero(), request.altura(), request.idBarrio(),
                request.longitud(), request.latitud());

        return DomicilioResponse.de(propiedad, vinculo);
    }

    /** RF-10 y RF-12. */
    @Transactional
    public DomicilioPrincipalResponse marcarPrincipal(Long propiedadId) {
        CiudadanoPropiedad vinculo = vinculoOperable(propiedadId);
        Long ciudadanoId = vinculo.getId().getIdCiudadano();

        if (vinculo.getVigenteHasta() != null) {
            throw ApiException.conflicto("No se puede marcar como principal un domicilio dado de baja");
        }
        if (vinculo.isEsPrincipal()) {
            throw ApiException.conflicto("El domicilio ya es el principal");
        }

        desmarcarPrincipalVigente(ciudadanoId);
        vinculo.setEsPrincipal(true);

        return new DomicilioPrincipalResponse(propiedadId, ciudadanoId, true, OffsetDateTime.now());
    }

    /**
     * RF-11: cierra la vigencia en lugar de borrar. Si el domicilio era el
     * principal, el mas reciente de los que quedan vigentes lo reemplaza; si no
     * queda ninguno, la baja se rechaza con 409.
     */
    @Transactional
    public DomicilioCerradoResponse darDeBaja(Long propiedadId) {
        CiudadanoPropiedad vinculo = vinculoOperable(propiedadId);
        Long ciudadanoId = vinculo.getId().getIdCiudadano();

        if (vinculo.getVigenteHasta() != null) {
            throw ApiException.conflicto("El domicilio ya estaba dado de baja");
        }

        Optional<CiudadanoPropiedad> reemplazo = vinculoRepository
                .findByIdIdCiudadanoAndVigenteHastaIsNull(ciudadanoId).stream()
                .filter(v -> !v.getId().getIdPropiedad().equals(propiedadId))
                .max(Comparator.comparing(CiudadanoPropiedad::getVigenteDesde));

        if (vinculo.isEsPrincipal() && reemplazo.isEmpty()) {
            throw ApiException.conflicto(
                    "Es el unico domicilio principal vigente: cargue otro domicilio antes de darlo de baja");
        }

        vinculo.setVigenteHasta(LocalDate.now());
        Long nuevoPrincipal = null;
        if (vinculo.isEsPrincipal()) {
            vinculo.setEsPrincipal(false);
            CiudadanoPropiedad sucesor = reemplazo.get();
            sucesor.setEsPrincipal(true);
            nuevoPrincipal = sucesor.getId().getIdPropiedad();
        }

        return new DomicilioCerradoResponse(propiedadId, vinculo.getVigenteHasta(), nuevoPrincipal);
    }

    /** Consulta inter-modulo: 404 si el ciudadano no tiene domicilio principal vigente. */
    @Transactional(readOnly = true)
    public DomicilioPrincipalInterModuloResponse domicilioPrincipal(Long ciudadanoId) {
        exigirCiudadano(ciudadanoId);
        CiudadanoPropiedad vinculo = vinculoRepository
                .findByIdIdCiudadanoAndEsPrincipalTrueAndVigenteHastaIsNull(ciudadanoId)
                .orElseThrow(() -> ApiException.noEncontrado("El ciudadano no tiene domicilio principal vigente"));

        Propiedad p = propiedad(vinculo.getId().getIdPropiedad());
        return new DomicilioPrincipalInterModuloResponse(p.getPropiedadId(), p.getCalle(), p.getNumero(),
                p.getIdBarrio(), p.getLongitud(), p.getLatitud());
    }

    /** Resumen del domicilio principal, para embeber en otras respuestas. */
    @Transactional(readOnly = true)
    public Optional<DomicilioResponse> principalDe(Long ciudadanoId) {
        return vinculoRepository.findByIdIdCiudadanoAndEsPrincipalTrueAndVigenteHastaIsNull(ciudadanoId)
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

    private void desmarcarPrincipalVigente(Long ciudadanoId) {
        vinculoRepository.findByIdIdCiudadanoAndEsPrincipalTrueAndVigenteHastaIsNull(ciudadanoId)
                .ifPresent(actual -> actual.setEsPrincipal(false));
        // El indice parcial uk_pp_principal_vigente no tolera dos principales a
        // la vez, asi que hay que bajar el anterior antes de subir el nuevo.
        vinculoRepository.flush();
    }

    private Propiedad propiedad(Long propiedadId) {
        return propiedadRepository.findById(propiedadId)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el domicilio " + propiedadId));
    }

    private void exigirCiudadano(Long ciudadanoId) {
        if (!ciudadanoRepository.existsById(ciudadanoId)) {
            throw ApiException.noEncontrado("No existe el ciudadano " + ciudadanoId);
        }
    }

    /**
     * Los endpoints /domicilios/{id} no traen ciudadanoId, asi que hay que
     * deducir sobre que vinculo se opera: el del propio usuario, o el unico que
     * exista si quien llama es interno.
     */
    private CiudadanoPropiedad vinculoOperable(Long propiedadId) {
        List<CiudadanoPropiedad> vinculos = vinculoRepository.findByIdIdPropiedad(propiedadId);
        if (vinculos.isEmpty()) {
            throw ApiException.noEncontrado("No existe el domicilio " + propiedadId);
        }

        // Las tres operaciones que pasan por aca son escrituras.
        if (!autorizacion.puede(Permiso.EDITAR_TERCEROS)) {
            Long propio = autorizacion.actual().id();
            return vinculos.stream()
                    .filter(v -> v.getId().getIdCiudadano().equals(propio))
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

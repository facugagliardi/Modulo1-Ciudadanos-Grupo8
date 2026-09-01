package ar.edu.uade.ciudadanos.organizacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.common.TransicionesEstado;
import ar.edu.uade.ciudadanos.organizacion.dto.CrearRepresentacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.RepresentacionDeOrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.RepresentacionDePersonaResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.RepresentacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.VigenciaRepresentacionResponse;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Representacion;
import ar.edu.uade.ciudadanos.organizacion.repository.OrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import ar.edu.uade.ciudadanos.persona.PersonaDirectorioService;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.persona.dto.DatosPersona;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Poderes de representacion sobre organizaciones (RF-20, RF-21, RF-22). */
@Service
public class RepresentacionService {

    private final RepresentacionRepository representacionRepository;
    private final OrganizacionRepository organizacionRepository;
    private final PersonaDirectorioService directorio;
    private final AutorizacionService autorizacion;

    public RepresentacionService(RepresentacionRepository representacionRepository,
                                 OrganizacionRepository organizacionRepository,
                                 PersonaDirectorioService directorio,
                                 AutorizacionService autorizacion) {
        this.representacionRepository = representacionRepository;
        this.organizacionRepository = organizacionRepository;
        this.directorio = directorio;
        this.autorizacion = autorizacion;
    }

    /** RF-20. Otorgar un poder es potestad de la organizacion, no del apoderado. */
    @Transactional
    public RepresentacionResponse crear(CrearRepresentacionRequest request) {
        directorio.exigirQueExista(request.personaId());
        buscarOrganizacion(request.organizacionId());
        autorizacion.exigirGestionDeRepresentaciones(request.organizacionId());

        if (request.hasta() != null && request.hasta().isBefore(request.desde())) {
            throw ApiException.invalido("hasta no puede ser anterior a desde");
        }

        // El indice parcial uk_representacion_vigente ya lo impide en la base;
        // aca se chequea antes para devolver un 409 con un mensaje util.
        boolean yaTieneVigente = representacionRepository
                .findByOrganizacionIdAndEstado(request.organizacionId(), EstadoRepresentacion.VIGENTE).stream()
                .anyMatch(r -> r.getPersonaId().equals(request.personaId()));
        if (yaTieneVigente) {
            throw ApiException.conflicto("La persona ya tiene una representacion vigente sobre esa organizacion");
        }

        Representacion representacion = new Representacion();
        representacion.setPersonaId(request.personaId());
        representacion.setOrganizacionId(request.organizacionId());
        representacion.setAlcance(ListasBlancas.exigir(
                request.alcance(), ListasBlancas.ALCANCES_REPRESENTACION, "alcance"));
        representacion.setDesde(request.desde());
        representacion.setHasta(request.hasta());
        representacion.setEstado(EstadoRepresentacion.VIGENTE);

        return RepresentacionResponse.de(representacionRepository.save(representacion));
    }

    @Transactional(readOnly = true)
    public List<RepresentacionDeOrganizacionResponse> listarDeOrganizacion(Long organizacionId) {
        buscarOrganizacion(organizacionId);
        return representacionRepository.findByOrganizacionId(organizacionId).stream()
                .map(r -> {
                    DatosPersona p = directorio.resolver(r.getPersonaId());
                    return new RepresentacionDeOrganizacionResponse(r.getRepresentacionId(), p.personaId(),
                            p.nombre(), p.apellido(), r.getAlcance(), r.getDesde(), r.getHasta(),
                            estadoEfectivo(r));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RepresentacionDePersonaResponse> listarDePersona(Long personaId) {
        directorio.exigirQueExista(personaId);
        autorizacion.exigirLecturaDePersona(personaId);

        return representacionRepository.findByPersonaId(personaId).stream()
                .map(r -> {
                    String razonSocial = organizacionRepository.findById(r.getOrganizacionId())
                            .map(Organizacion::getRazonSocial).orElse(null);
                    return new RepresentacionDePersonaResponse(r.getRepresentacionId(), r.getOrganizacionId(),
                            razonSocial, r.getAlcance(), r.getDesde(), r.getHasta(), estadoEfectivo(r));
                })
                .toList();
    }

    /** RF-21: revocar o dar por vencida. */
    @Transactional
    public CambioEstadoResponse cambiarEstado(Long representacionId, EstadoRepresentacion nuevo) {
        Representacion representacion = buscar(representacionId);
        autorizacion.exigirGestionDeRepresentaciones(representacion.getOrganizacionId());

        EstadoRepresentacion anterior = representacion.getEstado();
        TransicionesEstado.exigirRepresentacion(anterior, nuevo);
        representacion.setEstado(nuevo);
        if (nuevo != EstadoRepresentacion.VIGENTE && representacion.getHasta() == null) {
            representacion.setHasta(LocalDate.now());
        }

        return CambioEstadoResponse.de(representacionId, anterior, nuevo);
    }

    /**
     * RF-22: el chequeo que hacen los otros modulos antes de dejar operar a
     * alguien en nombre de una organizacion. Nunca 404.
     */
    @Transactional(readOnly = true)
    public VigenciaRepresentacionResponse consultarVigencia(Long ciudadanoId, Long organizacionId) {
        if (ciudadanoId == null || organizacionId == null) {
            throw ApiException.invalido("ciudadanoId y organizacionId son obligatorios");
        }
        return representacionRepository.findVigente(ciudadanoId, organizacionId, LocalDate.now())
                .map(r -> new VigenciaRepresentacionResponse(true, r.getRepresentacionId(), r.getAlcance(),
                        r.getHasta()))
                .orElseGet(VigenciaRepresentacionResponse::noVigente);
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Una representacion cuyo "hasta" ya paso esta vencida de hecho aunque la
     * fila siga diciendo VIGENTE: nadie corrio todavia el cierre. Se informa el
     * estado real, sin escribir.
     */
    private EstadoRepresentacion estadoEfectivo(Representacion r) {
        boolean vencidaDeHecho = r.getEstado() == EstadoRepresentacion.VIGENTE
                && r.getHasta() != null && r.getHasta().isBefore(LocalDate.now());
        return vencidaDeHecho ? EstadoRepresentacion.VENCIDA : r.getEstado();
    }

    private Representacion buscar(Long id) {
        return representacionRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe la representacion " + id));
    }

    private Organizacion buscarOrganizacion(Long id) {
        return organizacionRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe la organizacion " + id));
    }
}

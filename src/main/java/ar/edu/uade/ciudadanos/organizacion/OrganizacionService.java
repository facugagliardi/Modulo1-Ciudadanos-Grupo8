package ar.edu.uade.ciudadanos.organizacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.common.TransicionesEstado;
import ar.edu.uade.ciudadanos.domicilio.DomicilioService;
import ar.edu.uade.ciudadanos.organizacion.dto.ActualizarDuenoRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.ActualizarOrganizacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.AgregarDuenoRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.CrearOrganizacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.DuenoAgregadoResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.DuenoResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.ExistenciaOrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.IdentidadOrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.OrganizacionDeDuenoResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.OrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.OrganizacionResumenResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.RepresentanteVigenteResponse;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.PersonaOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.PersonaOrganizacionId;
import ar.edu.uade.ciudadanos.organizacion.repository.OrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.PersonaOrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import ar.edu.uade.ciudadanos.persona.PersonaDirectorioService;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.persona.dto.DatosPersona;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Organizaciones y sus duenos (RF-02, RF-08, RF-19). */
@Service
public class OrganizacionService {

    private static final String TIPO_POR_DEFECTO = "OTRO";

    private final OrganizacionRepository organizacionRepository;
    private final PersonaOrganizacionRepository duenoRepository;
    private final RepresentacionRepository representacionRepository;
    private final PersonaDirectorioService directorio;
    private final DomicilioService domicilioService;
    private final AutorizacionService autorizacion;

    public OrganizacionService(OrganizacionRepository organizacionRepository,
                               PersonaOrganizacionRepository duenoRepository,
                               RepresentacionRepository representacionRepository,
                               PersonaDirectorioService directorio,
                               DomicilioService domicilioService,
                               AutorizacionService autorizacion) {
        this.organizacionRepository = organizacionRepository;
        this.duenoRepository = duenoRepository;
        this.representacionRepository = representacionRepository;
        this.directorio = directorio;
        this.domicilioService = domicilioService;
        this.autorizacion = autorizacion;
    }

    @Transactional
    public OrganizacionResponse crear(CrearOrganizacionRequest request) {
        Long cuit = normalizarCuit(request.cuit());
        if (organizacionRepository.existsByCuit(cuit)) {
            throw ApiException.conflicto("Ya existe una organizacion con el CUIT " + cuit);
        }

        String taxId = request.taxId() == null || request.taxId().isBlank()
                ? String.valueOf(cuit)
                : request.taxId().trim();
        if (organizacionRepository.existsByTaxId(taxId)) {
            throw ApiException.conflicto("Ya existe una organizacion con el taxId " + taxId);
        }

        // Los duenos se validan ANTES de crear nada: si uno no existe, no queda
        // una organizacion a medio armar.
        java.math.BigDecimal sumaPorcentajes = java.math.BigDecimal.ZERO;
        for (var dueno : request.duenos()) {
            directorio.exigirQueExista(dueno.personaId());
            if (dueno.porcentajeTitularidad() != null) {
                sumaPorcentajes = sumaPorcentajes.add(dueno.porcentajeTitularidad());
            }
        }
        if (sumaPorcentajes.compareTo(java.math.BigDecimal.valueOf(100)) > 0) {
            throw ApiException.conflicto("La suma de titularidades iniciales supera el 100%");
        }

        Organizacion organizacion = new Organizacion();
        organizacion.setCuit(cuit);
        organizacion.setTaxId(taxId);
        organizacion.setRazonSocial(request.razonSocial().trim());
        organizacion.setNombre(request.nombreFantasia());
        organizacion.setTipo(tipoValidado(request.tipo()));
        organizacion.setEstado(EstadoOrganizacion.ACTIVA);
        organizacionRepository.save(organizacion);

        request.duenos().forEach(dueno -> {
            PersonaOrganizacion vinculo = new PersonaOrganizacion();
            vinculo.setId(new PersonaOrganizacionId(dueno.personaId(), organizacion.getOrganizacionId()));
            vinculo.setPorcentajeTitularidad(dueno.porcentajeTitularidad());
            duenoRepository.save(vinculo);
        });

        return armar(organizacion);
    }

    @Transactional(readOnly = true)
    public OrganizacionResponse obtener(Long id) {
        return armar(buscar(id));
    }

    @Transactional(readOnly = true)
    public List<OrganizacionResumenResponse> listar() {
        return organizacionRepository.findAll().stream().map(OrganizacionResumenResponse::de).toList();
    }

    /**
     * Las organizaciones donde la persona es duena (RF-19).
     *
     * Existia el listado de representaciones pero no este, y son vinculos
     * distintos: el alta de una organizacion anota al creador como DUENO, nunca
     * como representante. Sin esta consulta, quien registraba una organizacion
     * no tenia forma de volver a encontrarla desde el portal.
     *
     * Los ids se resuelven con un findAllById en vez de un findById por
     * vinculo: son dos consultas en total, no una por organizacion.
     */
    @Transactional(readOnly = true)
    public List<OrganizacionDeDuenoResponse> listarPorDueno(Long personaId) {
        directorio.exigirQueExista(personaId);
        autorizacion.exigirLecturaDePersona(personaId);

        List<PersonaOrganizacion> vinculos = duenoRepository.findByIdIdPersona(personaId);
        if (vinculos.isEmpty()) {
            return List.of();
        }

        Map<Long, Organizacion> porId = organizacionRepository
                .findAllById(vinculos.stream().map(v -> v.getId().getIdOrganizacion()).toList())
                .stream()
                .collect(Collectors.toMap(Organizacion::getOrganizacionId, o -> o));

        return vinculos.stream()
                .map(v -> {
                    Organizacion o = porId.get(v.getId().getIdOrganizacion());
                    // Un vinculo sin organizacion solo puede venir de datos
                    // inconsistentes; se saltea en vez de romper el listado.
                    return o == null ? null : OrganizacionDeDuenoResponse.de(o, v.getPorcentajeTitularidad());
                })
                .filter(Objects::nonNull)
                .toList();
    }

    @Transactional
    public OrganizacionResponse actualizar(Long id, ActualizarOrganizacionRequest request) {
        Organizacion organizacion = buscar(id);
        autorizacion.exigirEscrituraSobreOrganizacion(id);

        if (request.razonSocial() != null) {
            organizacion.setRazonSocial(request.razonSocial().trim());
        }
        if (request.nombreFantasia() != null) {
            organizacion.setNombre(request.nombreFantasia());
        }
        if (request.tipo() != null) {
            organizacion.setTipo(ListasBlancas.exigir(request.tipo(), ListasBlancas.TIPOS_ORGANIZACION, "tipo"));
        }

        return armar(organizacion);
    }

    /** RF-08: baja y alta de la organizacion. Accion administrativa. */
    @Transactional
    public CambioEstadoResponse cambiarEstado(Long id, EstadoOrganizacion nuevo) {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_TITULAR, "cambiar el estado de una organizacion");
        Organizacion organizacion = buscar(id);

        EstadoOrganizacion anterior = organizacion.getEstado();
        TransicionesEstado.exigirOrganizacion(anterior, nuevo);
        organizacion.setEstado(nuevo);

        return CambioEstadoResponse.de(id, anterior, nuevo);
    }

    /** RF-06. Nunca 404. */
    @Transactional(readOnly = true)
    public ExistenciaOrganizacionResponse buscarPorCuit(String cuitCrudo) {
        Long cuit = normalizarCuit(cuitCrudo);
        return organizacionRepository.findByCuit(cuit)
                .map(o -> new ExistenciaOrganizacionResponse(true, o.getOrganizacionId(), o.getRazonSocial(),
                        o.getEstado()))
                .orElseGet(ExistenciaOrganizacionResponse::noExiste);
    }

    @Transactional(readOnly = true)
    public IdentidadOrganizacionResponse identidad(Long id) {
        Organizacion o = buscar(id);
        return new IdentidadOrganizacionResponse(o.getOrganizacionId(), String.valueOf(o.getCuit()),
                o.getRazonSocial(), o.getEstado());
    }

    // ------------------------------------------------------------------- duenos

    @Transactional
    public DuenoAgregadoResponse agregarDueno(Long organizacionId, AgregarDuenoRequest request) {
        buscar(organizacionId);
        autorizacion.exigirEscrituraSobreOrganizacion(organizacionId);
        DatosPersona persona = directorio.resolver(request.personaId());

        PersonaOrganizacionId clave = new PersonaOrganizacionId(request.personaId(), organizacionId);
        if (duenoRepository.existsById(clave)) {
            throw ApiException.conflicto("La persona ya figura como duena de la organizacion");
        }
        exigirTitularidadCoherente(organizacionId, request.porcentajeTitularidad(), null);

        PersonaOrganizacion vinculo = new PersonaOrganizacion();
        vinculo.setId(clave);
        vinculo.setPorcentajeTitularidad(request.porcentajeTitularidad());
        duenoRepository.save(vinculo);

        return new DuenoAgregadoResponse(organizacionId, persona.personaId(), persona.dni(),
                vinculo.getPorcentajeTitularidad(), vinculo.getAsociadoEn());
    }

    @Transactional
    public DuenoResponse actualizarDueno(Long organizacionId, Long personaId, ActualizarDuenoRequest request) {
        buscar(organizacionId);
        autorizacion.exigirEscrituraSobreOrganizacion(organizacionId);
        DatosPersona persona = directorio.resolver(personaId);

        PersonaOrganizacionId clave = new PersonaOrganizacionId(personaId, organizacionId);
        PersonaOrganizacion vinculo = duenoRepository.findById(clave)
                .orElseThrow(() -> ApiException.noEncontrado("La persona " + personaId + " no es duena de la organizacion"));

        exigirTitularidadCoherente(organizacionId, request.porcentajeTitularidad(), personaId);

        vinculo.setPorcentajeTitularidad(request.porcentajeTitularidad());
        duenoRepository.save(vinculo);

        return new DuenoResponse(persona.personaId(), persona.dni(), persona.nombre(), persona.apellido(),
                vinculo.getPorcentajeTitularidad());
    }

    @Transactional(readOnly = true)
    public List<DuenoResponse> listarDuenos(Long organizacionId) {
        buscar(organizacionId);
        return duenos(organizacionId);
    }

    @Transactional
    public void quitarDueno(Long organizacionId, Long personaId) {
        buscar(organizacionId);
        autorizacion.exigirEscrituraSobreOrganizacion(organizacionId);

        PersonaOrganizacionId clave = new PersonaOrganizacionId(personaId, organizacionId);
        if (!duenoRepository.existsById(clave)) {
            throw ApiException.noEncontrado("La persona " + personaId + " no es duena de la organizacion");
        }
        if (duenoRepository.findByIdIdOrganizacion(organizacionId).size() == 1) {
            throw ApiException.conflicto("Es el unico dueno: la organizacion no puede quedar sin titular");
        }
        duenoRepository.deleteById(clave);
    }

    // ------------------------------------------------------------------ helpers

    private OrganizacionResponse armar(Organizacion o) {
        List<RepresentanteVigenteResponse> representantes = representacionRepository
                .findByOrganizacionIdAndEstado(o.getOrganizacionId(), EstadoRepresentacion.VIGENTE).stream()
                .filter(r -> r.getHasta() == null || !r.getHasta().isBefore(LocalDate.now()))
                .map(r -> {
                    DatosPersona p = directorio.resolver(r.getPersonaId());
                    return new RepresentanteVigenteResponse(p.personaId(), p.nombre(), p.apellido(),
                            r.getAlcance(), r.getDesde(), r.getHasta());
                })
                .toList();

        return new OrganizacionResponse(o.getOrganizacionId(), String.valueOf(o.getCuit()), o.getTaxId(),
                o.getRazonSocial(), o.getNombre(), o.getTipo(), o.getEstado(), o.getCreadoEn(),
                domicilioPrincipalDe(o), duenos(o.getOrganizacionId()), representantes);
    }

    /**
     * La organizacion no es una persona, asi que su domicilio se busca por la
     * persona juridica que comparte el CUIT, si existe.
     */
    private ar.edu.uade.ciudadanos.domicilio.dto.DomicilioResponse domicilioPrincipalDe(Organizacion o) {
        return duenoRepository.findByIdIdOrganizacion(o.getOrganizacionId()).stream()
                .map(v -> v.getId().getIdPersona())
                .filter(personaId -> String.valueOf(o.getCuit()).equals(directorio.resolver(personaId).cuit()))
                .findFirst()
                .flatMap(domicilioService::principalDe)
                .orElse(null);
    }

    private List<DuenoResponse> duenos(Long organizacionId) {
        return duenoRepository.findByIdIdOrganizacion(organizacionId).stream()
                .map(v -> {
                    DatosPersona p = directorio.resolver(v.getId().getIdPersona());
                    return new DuenoResponse(p.personaId(), p.dni(), p.nombre(), p.apellido(),
                            v.getPorcentajeTitularidad());
                })
                .toList();
    }

    /** La suma de titularidades declaradas no puede pasarse de 100. */
    private void exigirTitularidadCoherente(Long organizacionId, java.math.BigDecimal nuevo, Long ignorar) {
        if (nuevo == null) {
            return;
        }
        java.math.BigDecimal acumulado = duenoRepository.findByIdIdOrganizacion(organizacionId).stream()
                .filter(v -> ignorar == null || !v.getId().getIdPersona().equals(ignorar))
                .map(PersonaOrganizacion::getPorcentajeTitularidad)
                .filter(java.util.Objects::nonNull)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        if (acumulado.add(nuevo).compareTo(java.math.BigDecimal.valueOf(100)) > 0) {
            throw ApiException.conflicto("La suma de titularidades superaria el 100% (ya asignado: " + acumulado + ")");
        }
    }

    private String tipoValidado(String tipo) {
        return tipo == null || tipo.isBlank()
                ? TIPO_POR_DEFECTO
                : ListasBlancas.exigir(tipo, ListasBlancas.TIPOS_ORGANIZACION, "tipo");
    }

    private Long normalizarCuit(String crudo) {
        String digitos = crudo == null ? "" : crudo.replaceAll("\\D", "");
        if (digitos.length() != 11) {
            throw ApiException.invalido("El CUIT debe tener 11 digitos");
        }
        return Long.valueOf(digitos);
    }

    private Organizacion buscar(Long id) {
        return organizacionRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe la organizacion " + id));
    }
}

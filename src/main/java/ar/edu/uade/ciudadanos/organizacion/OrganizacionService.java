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
import ar.edu.uade.ciudadanos.organizacion.entity.CiudadanoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.CiudadanoOrganizacionId;
import ar.edu.uade.ciudadanos.organizacion.repository.OrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.CiudadanoOrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
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
    private final CiudadanoOrganizacionRepository duenoRepository;
    private final RepresentacionRepository representacionRepository;
    private final CiudadanoDirectorioService directorio;
    private final DomicilioService domicilioService;
    private final AutorizacionService autorizacion;

    public OrganizacionService(OrganizacionRepository organizacionRepository,
                               CiudadanoOrganizacionRepository duenoRepository,
                               RepresentacionRepository representacionRepository,
                               CiudadanoDirectorioService directorio,
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
    public OrganizacionResponse crear(Long creadorId, CrearOrganizacionRequest request) {
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

        directorio.exigirQueExista(creadorId);

        Organizacion organizacion = new Organizacion();
        organizacion.setCuit(cuit);
        organizacion.setTaxId(taxId);
        organizacion.setRazonSocial(request.razonSocial().trim());
        organizacion.setNombre(request.nombreFantasia());
        organizacion.setTipo(tipoValidado(request.tipo()));
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacionRepository.save(organizacion);

        CiudadanoOrganizacion vinculo = new CiudadanoOrganizacion();
        vinculo.setId(new CiudadanoOrganizacionId(creadorId, organizacion.getOrganizacionId()));
        vinculo.setPorcentajeTitularidad(java.math.BigDecimal.valueOf(100));
        duenoRepository.save(vinculo);

        return armar(organizacion);
    }

    @Transactional(readOnly = true)
    public List<OrganizacionResumenResponse> listarPendientes() {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_TITULAR, "listar organizaciones pendientes");
        return organizacionRepository.findAll().stream()
                .filter(o -> o.getEstado() == EstadoOrganizacion.PENDIENTE)
                .map(OrganizacionResumenResponse::de).toList();
    }

    @Transactional
    public OrganizacionResponse aprobar(Long id) {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_TITULAR, "aprobar una organizacion");
        Organizacion organizacion = buscar(id);
        if (organizacion.getEstado() != EstadoOrganizacion.PENDIENTE) {
            throw ApiException.conflicto("La organizacion no esta PENDIENTE");
        }
        organizacion.setEstado(EstadoOrganizacion.ACTIVA);
        return armar(organizacion);
    }

    @Transactional
    public OrganizacionResponse rechazar(Long id) {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_TITULAR, "rechazar una organizacion");
        Organizacion organizacion = buscar(id);
        if (organizacion.getEstado() != EstadoOrganizacion.PENDIENTE) {
            throw ApiException.conflicto("La organizacion no esta PENDIENTE");
        }
        organizacion.setEstado(EstadoOrganizacion.RECHAZADA);
        return armar(organizacion);
    }

    @Transactional(readOnly = true)
    public OrganizacionResponse obtener(Long id) {
        autorizacion.exigirLecturaSobreOrganizacion(id);
        return armar(buscar(id));
    }

    @Transactional(readOnly = true)
    public List<OrganizacionResumenResponse> listar() {
        return organizacionRepository.findAll().stream().map(OrganizacionResumenResponse::de).toList();
    }

    @Transactional(readOnly = true)
    public List<OrganizacionDeDuenoResponse> listarPorDueno(Long personaId) {
        directorio.exigirQueExista(personaId);
        autorizacion.exigirLecturaDePersona(personaId);

        List<CiudadanoOrganizacion> vinculos = duenoRepository.findByIdIdCiudadano(personaId);
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

    @Transactional
    public CambioEstadoResponse cambiarEstado(Long id, EstadoOrganizacion nuevo) {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_TITULAR, "cambiar el estado de una organizacion");
        Organizacion organizacion = buscar(id);

        EstadoOrganizacion anterior = organizacion.getEstado();
        TransicionesEstado.exigirOrganizacion(anterior, nuevo);
        organizacion.setEstado(nuevo);

        return CambioEstadoResponse.de(id, anterior, nuevo);
    }

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

        CiudadanoOrganizacionId clave = new CiudadanoOrganizacionId(request.personaId(), organizacionId);
        if (duenoRepository.existsById(clave)) {
            throw ApiException.conflicto("El ciudadano ya figura como dueno de la organizacion");
        }

        if (request.ajustes() != null) {
            for (var ajuste : request.ajustes()) {
                CiudadanoOrganizacionId ajusteClave = new CiudadanoOrganizacionId(ajuste.personaId(), organizacionId);
                CiudadanoOrganizacion vinculoExistente = duenoRepository.findById(ajusteClave)
                        .orElseThrow(() -> ApiException.conflicto("El dueno a ajustar no existe en la organizacion"));
                vinculoExistente.setPorcentajeTitularidad(ajuste.nuevoPorcentaje());
                duenoRepository.save(vinculoExistente);
            }
        }

        exigirTitularidadCoherente(organizacionId, request.porcentajeTitularidad(), null);

        CiudadanoOrganizacion vinculo = new CiudadanoOrganizacion();
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

        CiudadanoOrganizacionId clave = new CiudadanoOrganizacionId(personaId, organizacionId);
        CiudadanoOrganizacion vinculo = duenoRepository.findById(clave)
                .orElseThrow(() -> ApiException.noEncontrado("El ciudadano " + personaId + " no es dueno de la organizacion"));

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
    public void quitarDueno(Long organizacionId, Long personaId, Long beneficiarioId) {
        buscar(organizacionId);
        autorizacion.exigirEscrituraSobreOrganizacion(organizacionId);

        CiudadanoOrganizacionId clave = new CiudadanoOrganizacionId(personaId, organizacionId);
        CiudadanoOrganizacion vinculo = duenoRepository.findById(clave)
                .orElseThrow(() -> ApiException.noEncontrado("El ciudadano " + personaId + " no es dueno de la organizacion"));

        java.util.List<CiudadanoOrganizacion> todosLosDuenos = duenoRepository.findByIdIdOrganizacion(organizacionId);
        if (todosLosDuenos.size() == 1) {
            throw ApiException.conflicto("Es el unico dueno: la organizacion no puede quedar sin titular");
        }
        
        java.math.BigDecimal porcentajeAEliminar = vinculo.getPorcentajeTitularidad();

        if (porcentajeAEliminar != null && porcentajeAEliminar.compareTo(java.math.BigDecimal.ZERO) > 0) {
            if (beneficiarioId != null) {
                // Asignar al beneficiario especifico
                CiudadanoOrganizacionId beneficiarioClave = new CiudadanoOrganizacionId(beneficiarioId, organizacionId);
                CiudadanoOrganizacion beneficiario = duenoRepository.findById(beneficiarioClave)
                        .orElseThrow(() -> ApiException.conflicto("El beneficiario especificado no es dueno de la organizacion"));
                java.math.BigDecimal nuevoPorcentaje = beneficiario.getPorcentajeTitularidad() != null 
                        ? beneficiario.getPorcentajeTitularidad().add(porcentajeAEliminar) 
                        : porcentajeAEliminar;
                beneficiario.setPorcentajeTitularidad(nuevoPorcentaje);
                duenoRepository.save(beneficiario);
            } else {
                // Repartir proporcionalmente
                java.math.BigDecimal sumaRestantes = todosLosDuenos.stream()
                        .filter(d -> !d.getId().getIdCiudadano().equals(personaId))
                        .map(d -> d.getPorcentajeTitularidad() != null ? d.getPorcentajeTitularidad() : java.math.BigDecimal.ZERO)
                        .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
                
                if (sumaRestantes.compareTo(java.math.BigDecimal.ZERO) > 0) {
                    for (CiudadanoOrganizacion d : todosLosDuenos) {
                        if (!d.getId().getIdCiudadano().equals(personaId)) {
                            java.math.BigDecimal actual = d.getPorcentajeTitularidad() != null ? d.getPorcentajeTitularidad() : java.math.BigDecimal.ZERO;
                            java.math.BigDecimal proporcion = actual.divide(sumaRestantes, 4, java.math.RoundingMode.HALF_UP);
                            java.math.BigDecimal sumar = porcentajeAEliminar.multiply(proporcion);
                            d.setPorcentajeTitularidad(actual.add(sumar));
                            duenoRepository.save(d);
                        }
                    }
                }
            }
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

    private ar.edu.uade.ciudadanos.domicilio.dto.DomicilioResponse domicilioPrincipalDe(Organizacion o) {
        return duenoRepository.findByIdIdOrganizacion(o.getOrganizacionId()).stream()
                .map(v -> v.getId().getIdCiudadano())
                .filter(personaId -> String.valueOf(o.getCuit()).equals(directorio.resolver(personaId).cuit()))
                .findFirst()
                .flatMap(domicilioService::principalDe)
                .orElse(null);
    }

    private List<DuenoResponse> duenos(Long organizacionId) {
        return duenoRepository.findByIdIdOrganizacion(organizacionId).stream()
                .map(v -> {
                    DatosPersona p = directorio.resolver(v.getId().getIdCiudadano());
                    return new DuenoResponse(p.personaId(), p.dni(), p.nombre(), p.apellido(),
                            v.getPorcentajeTitularidad());
                })
                .toList();
    }

    private void exigirTitularidadCoherente(Long organizacionId, java.math.BigDecimal nuevo, Long ignorar) {
        if (nuevo == null) {
            return;
        }
        java.math.BigDecimal acumulado = duenoRepository.findByIdIdOrganizacion(organizacionId).stream()
                .filter(v -> ignorar == null || !v.getId().getIdCiudadano().equals(ignorar))
                .map(CiudadanoOrganizacion::getPorcentajeTitularidad)
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

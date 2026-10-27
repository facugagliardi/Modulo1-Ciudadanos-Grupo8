package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.TransicionesEstado;
import ar.edu.uade.ciudadanos.contacto.dto.ContactoResponse;
import ar.edu.uade.ciudadanos.contacto.repository.ContactoCiudadanoRepository;
import ar.edu.uade.ciudadanos.domicilio.DomicilioService;
import ar.edu.uade.ciudadanos.persona.dto.ActualizarCiudadanoRequest;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.persona.dto.CiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.dto.CiudadanoResumenResponse;
import ar.edu.uade.ciudadanos.persona.dto.EstadoCiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.dto.ExistenciaCiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.dto.IdentidadCiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import ar.edu.uade.ciudadanos.evento.dto.UpdatedBy;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Consulta y mantenimiento de ciudadanos (RF-04 a RF-07). */
@Service
public class CiudadanoService {

    private final CiudadanoRepository ciudadanoRepository;
    private final ContactoCiudadanoRepository contactoRepository;
    private final DomicilioService domicilioService;
    private final AutorizacionService autorizacion;
    private final EventPublisherService eventPublisherService;

    public CiudadanoService(CiudadanoRepository ciudadanoRepository,
                            ContactoCiudadanoRepository contactoRepository,
                            DomicilioService domicilioService,
                            AutorizacionService autorizacion) {
        this(ciudadanoRepository, contactoRepository, domicilioService, autorizacion, null);
    }

    @Autowired
    public CiudadanoService(CiudadanoRepository ciudadanoRepository,
                            ContactoCiudadanoRepository contactoRepository,
                            DomicilioService domicilioService,
                            AutorizacionService autorizacion,
                            EventPublisherService eventPublisherService) {
        this.ciudadanoRepository = ciudadanoRepository;
        this.contactoRepository = contactoRepository;
        this.domicilioService = domicilioService;
        this.autorizacion = autorizacion;
        this.eventPublisherService = eventPublisherService;
    }

    @Transactional(readOnly = true)
    public CiudadanoResponse obtener(Long id) {
        Ciudadano ciudadano = buscar(id);
        autorizacion.exigirLecturaDePersona(id);

        List<ContactoResponse> contactos = contactoRepository.findByCiudadanoId(id).stream()
                .map(ContactoResponse::de).toList();

        return new CiudadanoResponse(ciudadano.getId(), ciudadano.getUuid(), ciudadano.getDocumentoId(), ciudadano.getNombre(),
                ciudadano.getApellido(), ciudadano.getFechaNacimiento(), String.valueOf(ciudadano.getCuit()), ciudadano.getEstado(),
                domicilioService.principalDe(id).orElse(null), contactos);
    }

    /**
     * Listado completo (la spec v2 deja el filtrado al front). Solo internos:
     * el padron entero no es dato que un ciudadano pueda descargar.
     */
    @Transactional(readOnly = true)
    public List<CiudadanoResumenResponse> listar() {
        autorizacion.exigir(Permiso.LISTAR_PADRON, "listar el padron de ciudadanos");

        List<Ciudadano> ciudadanos = ciudadanoRepository.findAll();

        return ciudadanos.stream()
                .map(c -> CiudadanoResumenResponse.de(c, c.getCuit()))
                .toList();
    }

    /** RF-04. Los campos no enviados quedan como estaban. */
    @Transactional
    public CiudadanoResponse actualizar(Long id, ActualizarCiudadanoRequest request) {
        Ciudadano ciudadano = buscar(id);
        autorizacion.exigirEscrituraSobrePersona(id);

        if (request.nombre() != null) {
            ciudadano.setNombre(request.nombre().trim());
        }
        if (request.apellido() != null) {
            ciudadano.setApellido(request.apellido().trim());
        }
        if (request.fechaNacimiento() != null) {
            ciudadano.setFechaNacimiento(request.fechaNacimiento());
        }
        if (request.dni() != null && !request.dni().equals(ciudadano.getDocumentoId())) {
            // RF-06: el DNI es unico en todo el padron.
            if (ciudadanoRepository.existsByDocumentoId(request.dni())) {
                throw ApiException.conflicto("Ya existe otro ciudadano con el DNI " + request.dni());
            }
            ciudadano.setDocumentoId(request.dni());
        }
        if (request.cuil() != null) {
            actualizarCuil(ciudadano, request.cuil());
        }

        if (eventPublisherService != null) {
            try {
                Map<String, Object> details = new java.util.HashMap<>();
                details.put("dni", ciudadano.getDocumentoId());
                details.put("cuil", String.valueOf(ciudadano.getCuit()));
                details.put("name", ciudadano.getNombre());
                details.put("lastname", ciudadano.getApellido());
                details.put("birthdate", String.valueOf(ciudadano.getFechaNacimiento()));
                details.put("state", ciudadano.getEstado().name());
                String citizenUuid = ciudadano.getUuid() != null ? ciudadano.getUuid().toString() : String.valueOf(id);
                eventPublisherService.publicarCitizenUpdated(
                        citizenUuid,
                        "UPDATED",
                        details,
                        UpdatedBy.selfService()
                );
            } catch (Exception ignored) {
            }
        }

        return obtenerSinChequeo(ciudadano);
    }

    /** RF-05: el cambio de estado es una accion administrativa. */
    @Transactional
    public CambioEstadoResponse cambiarEstado(Long id, EstadoCiudadano nuevo) {
        autorizacion.exigir(Permiso.CAMBIAR_ESTADO_TITULAR, "cambiar el estado de un ciudadano");
        Ciudadano ciudadano = buscar(id);

        EstadoCiudadano anterior = ciudadano.getEstado();
        TransicionesEstado.exigirCiudadano(anterior, nuevo);
        ciudadano.setEstado(nuevo);

        if (eventPublisherService != null) {
            try {
                String citizenUuid = ciudadano.getUuid() != null ? ciudadano.getUuid().toString() : String.valueOf(id);
                if (nuevo == EstadoCiudadano.BLOQUEADO) {
                    eventPublisherService.publicarCitizenUpdated(
                            citizenUuid,
                            "BLOCKED",
                            Map.of("reason", "ACCION_ADMINISTRATIVA", "reviewRequired", true),
                            UpdatedBy.areaUser("USR-M1-14")
                    );
                } else if (nuevo == EstadoCiudadano.FALLECIDO) {
                    eventPublisherService.publicarCitizenUpdated(
                            citizenUuid,
                            "DECEASED",
                            Map.of("deceasedAt", LocalDate.now().toString(), "source", "REGISTRO_CIVIL"),
                            UpdatedBy.areaUser("USR-M1-09")
                    );
                }
            } catch (Exception ignored) {
            }
        }

        return CambioEstadoResponse.de(id, anterior, nuevo);
    }

    /** RF-06. Nunca 404: si no existe devuelve {existe:false}. */
    @Transactional(readOnly = true)
    public ExistenciaCiudadanoResponse buscarPorDni(String dni) {
        if (dni == null || !dni.matches("^[0-9]{7,9}$")) {
            throw ApiException.invalido("El DNI debe tener entre 7 y 9 digitos");
        }
        return ciudadanoRepository.findByDocumentoId(dni)
                .map(c -> new ExistenciaCiudadanoResponse(true, c.getId(), c.getNombre(), c.getApellido(),
                        c.getEstado()))
                .orElseGet(ExistenciaCiudadanoResponse::noExiste);
    }

    @Transactional(readOnly = true)
    public IdentidadCiudadanoResponse identidad(Long id) {
        Ciudadano c = buscar(id);
        return new IdentidadCiudadanoResponse(c.getId(), c.getDocumentoId(), c.getNombre(), c.getApellido(),
                c.getEstado(), c.getUuid());
    }

    @Transactional(readOnly = true)
    public EstadoCiudadanoResponse estado(Long id) {
        return new EstadoCiudadanoResponse(id, buscar(id).getEstado());
    }

    // ------------------------------------------------------------------ helpers

    private void actualizarCuil(Ciudadano ciudadano, String cuilCrudo) {
        String digitos = cuilCrudo.replaceAll("\\D", "");
        if (digitos.length() != 11) {
            throw ApiException.invalido("El CUIL debe tener 11 digitos");
        }
        Long cuil = Long.valueOf(digitos);

        if (ciudadano.getCuit().equals(cuil)) {
            return;
        }
        if (ciudadanoRepository.existsByCuit(cuil)) {
            throw ApiException.conflicto("Ya existe otro ciudadano con el CUIL " + digitos);
        }
        ciudadano.setCuit(cuil);
    }

    /** Arma la respuesta cuando el permiso ya se verifico en el metodo llamador. */
    private CiudadanoResponse obtenerSinChequeo(Ciudadano ciudadano) {
        List<ContactoResponse> contactos = contactoRepository.findByCiudadanoId(ciudadano.getId()).stream()
                .map(ContactoResponse::de).toList();
        return new CiudadanoResponse(ciudadano.getId(), ciudadano.getUuid(), ciudadano.getDocumentoId(), ciudadano.getNombre(),
                ciudadano.getApellido(), ciudadano.getFechaNacimiento(), String.valueOf(ciudadano.getCuit()),
                ciudadano.getEstado(), domicilioService.principalDe(ciudadano.getId()).orElse(null), contactos);
    }

    private Ciudadano buscar(Long id) {
        return ciudadanoRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el ciudadano " + id));
    }
}

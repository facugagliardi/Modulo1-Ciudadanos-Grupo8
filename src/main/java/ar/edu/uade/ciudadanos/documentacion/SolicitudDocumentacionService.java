package ar.edu.uade.ciudadanos.documentacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.common.TransicionesEstado;
import ar.edu.uade.ciudadanos.documentacion.dto.CambioEstadoSolicitudRequest;
import ar.edu.uade.ciudadanos.documentacion.dto.CrearSolicitudRequest;
import ar.edu.uade.ciudadanos.documentacion.dto.SolicitudResponse;
import ar.edu.uade.ciudadanos.documentacion.entity.EstadoSolicitud;
import ar.edu.uade.ciudadanos.documentacion.entity.OrigenSolicitud;
import ar.edu.uade.ciudadanos.documentacion.entity.SolicitudDocumentacion;
import ar.edu.uade.ciudadanos.documentacion.repository.SolicitudDocumentacionRepository;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationDeliveredData;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Pedidos de documentacion faltante (RF-27, RF-28, RF-29). */
@Service
public class SolicitudDocumentacionService {

    private static final Logger log = LoggerFactory.getLogger(SolicitudDocumentacionService.class);

    private final SolicitudDocumentacionRepository solicitudRepository;
    private final DocumentoService documentoService;
    private final CiudadanoDirectorioService directorio;
    private final AutorizacionService autorizacion;
    private final EventPublisherService eventPublisherService;

    public SolicitudDocumentacionService(SolicitudDocumentacionRepository solicitudRepository,
                                         DocumentoService documentoService,
                                         CiudadanoDirectorioService directorio,
                                         AutorizacionService autorizacion) {
        this(solicitudRepository, documentoService, directorio, autorizacion, null);
    }

    @Autowired
    public SolicitudDocumentacionService(SolicitudDocumentacionRepository solicitudRepository,
                                         DocumentoService documentoService,
                                         CiudadanoDirectorioService directorio,
                                         AutorizacionService autorizacion,
                                         @Autowired(required = false) EventPublisherService eventPublisherService) {
        this.solicitudRepository = solicitudRepository;
        this.documentoService = documentoService;
        this.directorio = directorio;
        this.autorizacion = autorizacion;
        this.eventPublisherService = eventPublisherService;
    }

    /** RF-27, RF-29. Pedir documentacion lo hace el municipio u otro modulo. */
    @Transactional
    public SolicitudResponse crear(CrearSolicitudRequest request) {
        autorizacion.exigir(Permiso.SOLICITAR_DOCUMENTACION, "solicitar documentacion");
        directorio.exigirQueExista(request.titularId());

        if (request.plazo().isBefore(LocalDate.now())) {
            throw ApiException.invalido("El plazo no puede ser una fecha pasada");
        }

        SolicitudDocumentacion solicitud = new SolicitudDocumentacion();
        solicitud.setTitularId(request.titularId());
        solicitud.setTipoDocumento(ListasBlancas.exigir(
                request.tipoDocumento(), ListasBlancas.TIPOS_DOCUMENTO, "tipoDocumento"));
        solicitud.setPlazo(request.plazo());
        solicitud.setEstado(EstadoSolicitud.PENDIENTE);
        solicitud.setOrigen(request.origen() == null ? OrigenSolicitud.INTERNA : request.origen());

        return SolicitudResponse.de(solicitudRepository.save(solicitud));
    }

    /**
     * Listado completo para internos; un ciudadano solo ve las suyas, que es lo
     * util para el front del portal.
     */
    @Transactional(readOnly = true)
    public List<SolicitudResponse> listar() {
        List<SolicitudDocumentacion> solicitudes = autorizacion.puede(Permiso.LISTAR_PADRON)
                ? solicitudRepository.findAll()
                : solicitudRepository.findByTitularId(autorizacion.actual().id());
        return solicitudes.stream().map(SolicitudResponse::de).toList();
    }

    @Transactional(readOnly = true)
    public SolicitudResponse obtener(Long solicitudId) {
        SolicitudDocumentacion solicitud = buscar(solicitudId);
        autorizacion.exigirLecturaDePersona(solicitud.getTitularId());
        return SolicitudResponse.de(solicitud);
    }

    /** RF-28. */
    @Transactional
    public CambioEstadoResponse cambiarEstado(Long solicitudId, CambioEstadoSolicitudRequest request) {
        SolicitudDocumentacion solicitud = buscar(solicitudId);
        autorizacion.exigirEscrituraSobrePersona(solicitud.getTitularId());

        EstadoSolicitud anterior = solicitud.getEstado();
        EstadoSolicitud nuevo = request.estado();
        TransicionesEstado.exigirSolicitud(anterior, nuevo);

        if (nuevo == EstadoSolicitud.CUMPLIDA) {
            if (request.documentoId() == null) {
                throw ApiException.invalido(
                        "Para pasar la solicitud a CUMPLIDA hay que indicar el documentoId que la satisface");
            }
            documentoService.exigirDocumentoDe(request.documentoId(), solicitud.getTitularId());
            solicitud.setDocumentoId(request.documentoId());

            if (eventPublisherService != null) {
                try {
                    Map<String, Object> reqInfo = Map.of(
                            "requestId", "sol-doc-" + solicitud.getSolicitudId(),
                            "documentType", solicitud.getTipoDocumento(),
                            "status", "COMPLETED",
                            "documentId", "doc-" + request.documentoId()
                    );
                    Map<String, Object> fileInfo = Map.of(
                            "fileId", "exp-doc-" + solicitud.getSolicitudId(),
                            "number", "EXP-2026-DOC-" + solicitud.getSolicitudId(),
                            "initiatingArea", "DOCUMENTACION",
                            "status", "COMPLETED",
                            "documentationRequests", List.of(reqInfo)
                    );
                    String citizenUuid = directorio.resolverUuid(solicitud.getTitularId())
                            .map(UUID::toString)
                            .orElse(String.valueOf(solicitud.getTitularId()));
                    SocialDocumentationDeliveredData data = new SocialDocumentationDeliveredData(
                            citizenUuid,
                            "sol-" + solicitud.getSolicitudId(),
                            "prog-general",
                            List.of(fileInfo)
                    );
                    eventPublisherService.publicarSocialDocumentationDelivered(
                            "solicitud-cumplida-" + solicitud.getSolicitudId(),
                            UUID.randomUUID().toString(),
                            data
                    );
                    log.info("Evento socialDocumentationDelivered emitido por cumplimiento de solicitud id={}", solicitudId);
                } catch (Exception e) {
                    log.warn("No se pudo emitir evento por cumplimiento de documentacion: {}", e.getMessage());
                }
            }
        }
        if (nuevo == EstadoSolicitud.VENCIDA) {
            autorizacion.exigir(Permiso.SOLICITAR_DOCUMENTACION, "dar por vencida una solicitud");
        }

        solicitud.setEstado(nuevo);
        return CambioEstadoResponse.de(solicitudId, anterior, nuevo);
    }

    private SolicitudDocumentacion buscar(Long solicitudId) {
        return solicitudRepository.findById(solicitudId)
                .orElseThrow(() -> ApiException.noEncontrado("No existe la solicitud " + solicitudId));
    }
}

package ar.edu.uade.ciudadanos.documentacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.documentacion.almacenamiento.AlmacenamientoArchivos;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoCreadoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoPendienteResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoResumenResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoValidadoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.ValidarDocumentoRequest;
import ar.edu.uade.ciudadanos.documentacion.entity.Documento;
import ar.edu.uade.ciudadanos.documentacion.entity.ResultadoValidacion;
import ar.edu.uade.ciudadanos.documentacion.repository.DocumentoRepository;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Gestiona el ciclo de vida y validacion de documentos. */
@Service
public class DocumentoService {

    private final DocumentoRepository documentoRepository;
    private final AlmacenamientoArchivos almacenamiento;
    private final CiudadanoDirectorioService directorio;
    private final AutorizacionService autorizacion;

    public DocumentoService(DocumentoRepository documentoRepository,
                            AlmacenamientoArchivos almacenamiento,
                            CiudadanoDirectorioService directorio,
                            AutorizacionService autorizacion) {
        this.documentoRepository = documentoRepository;
        this.almacenamiento = almacenamiento;
        this.directorio = directorio;
        this.autorizacion = autorizacion;
    }

    /** RF-23: carga inicial. Empieza en version 1. */
    @Transactional
    public DocumentoCreadoResponse cargar(Long ciudadanoId, String tipoDocumento, MultipartFile archivo) {
        directorio.exigirQueExista(ciudadanoId);
        autorizacion.exigirEscrituraSobrePersona(ciudadanoId);

        String tipo = tipoDocumento.trim().toUpperCase();
        String ruta = almacenamiento.guardar(archivo, ciudadanoId, 1);

        Documento documento = new Documento();
        documento.setCiudadanoId(ciudadanoId);
        documento.setTipoDocumento(tipo);
        documento.setCargadoPor(autorizacion.actorActual());
        documento.setUrlArchivo(ruta);

        // Si lo carga un empleado ya arranca validado
        if (autorizacion.puede(Permiso.VALIDAR_DOCUMENTACION)) {
            documento.setResultadoValidacion(ResultadoValidacion.VALIDADO);
            documento.setFechaValidacion(OffsetDateTime.now());
            documento.setValidadoPor(autorizacion.actorActual());
        }

        documentoRepository.save(documento);
        return new DocumentoCreadoResponse(documento.getDocumentoId(), ciudadanoId, tipo, 1,
                documento.getCargadoPor(), documento.getFechaCreacion());
    }

    /** RF-24: nueva version. Se guarda como un nuevo registro para conservar historial. */
    @Transactional
    public DocumentoCreadoResponse nuevaVersion(Long documentoId, MultipartFile archivo) {
        Documento anterior = buscar(documentoId);
        autorizacion.exigirEscrituraSobrePersona(anterior.getCiudadanoId());

        String ruta = almacenamiento.guardar(archivo, anterior.getCiudadanoId(), anterior.getVersion() + 1);

        Documento documento = new Documento();
        documento.setCiudadanoId(anterior.getCiudadanoId());
        documento.setTipoDocumento(anterior.getTipoDocumento());
        documento.setVersion(anterior.getVersion() + 1);
        documento.setCargadoPor(autorizacion.actorActual());
        documento.setUrlArchivo(ruta);

        // Si lo carga un empleado ya arranca validado
        if (autorizacion.puede(Permiso.VALIDAR_DOCUMENTACION)) {
            documento.setResultadoValidacion(ResultadoValidacion.VALIDADO);
            documento.setFechaValidacion(OffsetDateTime.now());
            documento.setValidadoPor(autorizacion.actorActual());
        }

        documentoRepository.save(documento);
        return new DocumentoCreadoResponse(documento.getDocumentoId(), documento.getCiudadanoId(), documento.getTipoDocumento(),
                documento.getVersion(), documento.getCargadoPor(), documento.getFechaCreacion());
    }

    @Transactional(readOnly = true)
    public List<DocumentoResumenResponse> listarDeCiudadano(Long ciudadanoId) {
        directorio.exigirQueExista(ciudadanoId);
        autorizacion.exigirLecturaDePersona(ciudadanoId);
        return documentoRepository.findByCiudadanoId(ciudadanoId).stream().map(DocumentoResumenResponse::de).toList();
    }

    /**
     * RF-26: un administrador puede ver que esta pendiente para
     * ir validandolo, armando una cola de trabajo.
     */
    @Transactional(readOnly = true)
    public List<DocumentoPendienteResponse> listarPendientes() {
        autorizacion.exigir(Permiso.VALIDAR_DOCUMENTACION, "listar documentos pendientes");
        return documentoRepository.findAll().stream()
                .filter(d -> d.getResultadoValidacion() == ResultadoValidacion.PENDIENTE)
                .map(DocumentoPendienteResponse::de)
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentoResponse obtener(Long id) {
        Documento documento = buscar(id);
        autorizacion.exigirLecturaDePersona(documento.getCiudadanoId());
        return DocumentoResponse.de(documento);
    }

    /** RF-26: marcar el documento como aprobado o rechazado. */
    @Transactional
    public DocumentoValidadoResponse validar(Long id, ValidarDocumentoRequest request) {
        autorizacion.exigir(Permiso.VALIDAR_DOCUMENTACION, "validar documentos");
        Documento documento = buscar(id);

        if (documento.getResultadoValidacion() != ResultadoValidacion.PENDIENTE) {
            throw ApiException.conflicto("El documento ya fue validado");
        }

        ResultadoValidacion resultado = Boolean.TRUE.equals(request.aprobado()) ? ResultadoValidacion.VALIDADO : ResultadoValidacion.RECHAZADO;
        documento.setResultadoValidacion(resultado);
        documento.setFechaValidacion(OffsetDateTime.now());
        documento.setValidadoPor(autorizacion.actorActual());
        documento.setVigenciaHasta(request.vigenciaHasta());

        return new DocumentoValidadoResponse(id, documento.getValidadoPor(), resultado, request.vigenciaHasta(), documento.getFechaValidacion());
    }

    /**
     * Entrega el binario para visualizarlo. Aca es el unico punto donde hace
     * falta saber el mime type devuelto por el servicio de almacenamiento.
     */
    @Transactional(readOnly = true)
    public ArchivoDeDocumento archivoDe(Long id) {
        Documento documento = buscar(id);
        autorizacion.exigirLecturaDePersona(documento.getCiudadanoId());

        if (documento.getUrlArchivo() == null) {
            throw ApiException.conflicto("El documento no tiene archivo adjunto");
        }

        Resource recurso = almacenamiento.leer(documento.getUrlArchivo());
        String extension = documento.getUrlArchivo().substring(documento.getUrlArchivo().lastIndexOf('.') + 1);
        MediaType tipo = switch (extension.toLowerCase()) {
            case "pdf" -> MediaType.APPLICATION_PDF;
            case "png" -> MediaType.IMAGE_PNG;
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG;
            default -> MediaType.APPLICATION_OCTET_STREAM;
        };

        return new ArchivoDeDocumento(recurso, tipo, extraerNombreReal(documento.getUrlArchivo()));
    }

    /** Expuesto para uso interno de otros modulos o features. */
    @Transactional(readOnly = true)
    public Documento obtenerUltimaVersionValida(Long ciudadanoId, String tipoDocumento) {
        Documento documento = documentoRepository
                .findFirstByCiudadanoIdAndTipoDocumentoOrderByVersionDesc(ciudadanoId, tipoDocumento.trim().toUpperCase())
                .orElseThrow(() -> ApiException.noEncontrado(
                        "El ciudadano no tiene cargado un documento de tipo " + tipoDocumento));

        if (documento.getResultadoValidacion() != ResultadoValidacion.VALIDADO) {
            throw ApiException.conflicto("El documento de tipo " + tipoDocumento + " aun no fue aprobado");
        }
        if (documento.getVigenciaHasta() != null && documento.getVigenciaHasta().isBefore(LocalDate.now())) {
            throw ApiException.conflicto("El documento de tipo " + tipoDocumento + " esta vencido");
        }

        return documento;
    }

    /**
     * Asegura que el usuario logueado tenga un documento de un tipo especifico,
     * aprobado y vigente. Uso interno para autorizaciones fuertes.
     */
    @Transactional(readOnly = true)
    public void exigirDocumento(Long titularId, String tipoDocumento) {
        Documento documento = obtenerUltimaVersionValida(titularId, tipoDocumento);
        if (!documento.getCiudadanoId().equals(titularId)) {
            throw ApiException.prohibido("El documento no te pertenece");
        }
    }

    /**
     * Asegura que el documento exista y pertenezca al titular.
     */
    @Transactional(readOnly = true)
    public void exigirDocumentoDe(Long documentoId, Long titularId) {
        Documento documento = buscar(documentoId);
        if (!documento.getCiudadanoId().equals(titularId)) {
            throw ApiException.conflicto("El documento " + documentoId + " no pertenece a " + titularId);
        }
    }

    // ------------------------------------------------------------------ helpers

    private Documento buscar(Long id) {
        return documentoRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el documento " + id));
    }

    /** A los archivos se les pone un UUID; esto trata de sacar el nombre original. */
    private String extraerNombreReal(String ruta) {
        String archivo = ruta.substring(ruta.lastIndexOf('/') + 1);
        int primerGuion = archivo.indexOf('-');
        return primerGuion > 0 ? archivo.substring(primerGuion + 1) : archivo;
    }

    public record ArchivoDeDocumento(Resource recurso, MediaType tipo, String nombre) {
    }
}

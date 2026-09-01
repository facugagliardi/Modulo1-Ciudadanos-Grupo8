package ar.edu.uade.ciudadanos.documentacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.documentacion.almacenamiento.AlmacenamientoArchivos;
import ar.edu.uade.ciudadanos.documentacion.almacenamiento.ArchivosPermitidos;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoCreadoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoResumenResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoValidadoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.ValidarDocumentoRequest;
import ar.edu.uade.ciudadanos.documentacion.entity.Documento;
import ar.edu.uade.ciudadanos.documentacion.entity.ResultadoValidacion;
import ar.edu.uade.ciudadanos.documentacion.repository.DocumentoRepository;
import ar.edu.uade.ciudadanos.persona.PersonaDirectorioService;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Carga, versionado y validacion de documentos (RF-23 a RF-26). */
@Service
public class DocumentoService {

    private final DocumentoRepository documentoRepository;
    private final PersonaDirectorioService directorio;
    private final AlmacenamientoArchivos almacenamiento;
    private final AutorizacionService autorizacion;

    public DocumentoService(DocumentoRepository documentoRepository,
                            PersonaDirectorioService directorio,
                            AlmacenamientoArchivos almacenamiento,
                            AutorizacionService autorizacion) {
        this.documentoRepository = documentoRepository;
        this.directorio = directorio;
        this.almacenamiento = almacenamiento;
        this.autorizacion = autorizacion;
    }

    /** RF-23, RF-26. */
    @Transactional
    public DocumentoCreadoResponse cargar(Long personaId, String tipoDocumento, MultipartFile archivo) {
        directorio.exigirQueExista(personaId);
        autorizacion.exigirEscrituraSobrePersona(personaId);
        ArchivosPermitidos.exigirValido(archivo);

        String tipo = ListasBlancas.exigir(tipoDocumento, ListasBlancas.TIPOS_DOCUMENTO, "tipoDocumento");

        Documento documento = new Documento();
        documento.setPersonaId(personaId);
        documento.setTipoDocumento(tipo);
        documento.setVersion(1);
        documento.setCargadoPor(autorizacion.actorActual());
        documento.setResultadoValidacion(ResultadoValidacion.PENDIENTE);
        // Hay que persistir primero: el nombre del archivo se arma con el id.
        documentoRepository.saveAndFlush(documento);

        documento.setUrlArchivo(almacenamiento.guardar(archivo, documento.getDocumentoId(), 1));

        return new DocumentoCreadoResponse(documento.getDocumentoId(), personaId, tipo, 1,
                documento.getCargadoPor(), documento.getFechaCreacion());
    }

    /**
     * RF-24. Sube la version en la misma fila (el modelo tiene una sola columna
     * {@code version}). El archivo anterior no se pisa: queda en disco con su
     * numero de version, aunque la fila solo apunte al ultimo.
     */
    @Transactional
    public DocumentoCreadoResponse nuevaVersion(Long documentoId, MultipartFile archivo) {
        Documento documento = buscar(documentoId);
        autorizacion.exigirEscrituraSobrePersona(documento.getPersonaId());
        ArchivosPermitidos.exigirValido(archivo);

        int nueva = documento.getVersion() + 1;
        documento.setVersion(nueva);
        documento.setUrlArchivo(almacenamiento.guardar(archivo, documentoId, nueva));
        documento.setCargadoPor(autorizacion.actorActual());
        documento.setFechaCreacion(OffsetDateTime.now());
        // Una version nueva vuelve a requerir validacion.
        documento.setResultadoValidacion(ResultadoValidacion.PENDIENTE);
        documento.setValidadoPor(null);
        documento.setFechaValidacion(null);

        return new DocumentoCreadoResponse(documentoId, documento.getPersonaId(), documento.getTipoDocumento(),
                nueva, documento.getCargadoPor(), documento.getFechaCreacion());
    }

    @Transactional(readOnly = true)
    public List<DocumentoResumenResponse> listarDePersona(Long personaId) {
        directorio.exigirQueExista(personaId);
        autorizacion.exigirLecturaDePersona(personaId);
        return documentoRepository.findByPersonaId(personaId).stream().map(DocumentoResumenResponse::de).toList();
    }

    @Transactional(readOnly = true)
    public DocumentoResponse obtener(Long documentoId) {
        Documento documento = buscar(documentoId);
        autorizacion.exigirLecturaDePersona(documento.getPersonaId());
        return DocumentoResponse.de(documento);
    }

    /** RF-25, RF-26. Validar es potestad del municipio, no del titular. */
    @Transactional
    public DocumentoValidadoResponse validar(Long documentoId, ValidarDocumentoRequest request) {
        autorizacion.exigir(Permiso.VALIDAR_DOCUMENTACION, "validar documentacion");
        Documento documento = buscar(documentoId);

        if (documento.getResultadoValidacion() != ResultadoValidacion.PENDIENTE) {
            throw ApiException.conflicto(
                    "El documento ya fue " + documento.getResultadoValidacion()
                            + "; para revisarlo de nuevo hay que cargar una version nueva");
        }
        if (request.vigenciaHasta() != null && request.vigenciaHasta().isBefore(LocalDate.now())) {
            throw ApiException.invalido("vigenciaHasta no puede ser una fecha pasada");
        }

        ResultadoValidacion resultado = Boolean.TRUE.equals(request.aprobado())
                ? ResultadoValidacion.VALIDADO
                : ResultadoValidacion.RECHAZADO;

        documento.setResultadoValidacion(resultado);
        documento.setValidadoPor(autorizacion.actorActual());
        documento.setFechaValidacion(OffsetDateTime.now());
        if (resultado == ResultadoValidacion.VALIDADO) {
            documento.setVigenciaHasta(request.vigenciaHasta());
        }

        return new DocumentoValidadoResponse(documentoId, documento.getValidadoPor(), resultado,
                documento.getVigenciaHasta(), documento.getFechaValidacion());
    }

    // ------------------------------------------------------------------ helpers

    private Documento buscar(Long documentoId) {
        return documentoRepository.findById(documentoId)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el documento " + documentoId));
    }

    /** Lo usa SolicitudDocumentacionService para cerrar una solicitud. */
    Documento exigirDocumentoDe(Long documentoId, Long titularId) {
        Documento documento = buscar(documentoId);
        if (!documento.getPersonaId().equals(titularId)) {
            throw ApiException.invalido(
                    "El documento " + documentoId + " no pertenece al titular de la solicitud");
        }
        return documento;
    }
}

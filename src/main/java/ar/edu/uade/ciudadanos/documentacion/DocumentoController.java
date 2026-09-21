package ar.edu.uade.ciudadanos.documentacion;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoCreadoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoResumenResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.DocumentoValidadoResponse;
import ar.edu.uade.ciudadanos.documentacion.dto.ValidarDocumentoRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Documentacion de personas (RF-23 a RF-26). La carga es multipart. */
@RestController
public class DocumentoController {

    private final DocumentoService documentoService;

    public DocumentoController(DocumentoService documentoService) {
        this.documentoService = documentoService;
    }

    @PostMapping(value = "/personas/{personaId}/documentos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentoCreadoResponse> cargar(@PathVariable Long personaId,
                                                          @RequestParam String tipoDocumento,
                                                          @RequestPart MultipartFile archivo) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(documentoService.cargar(personaId, tipoDocumento, archivo));
    }

    @GetMapping("/personas/{personaId}/documentos")
    public ListaResponse<DocumentoResumenResponse> listarDePersona(@PathVariable Long personaId) {
        return ListaResponse.de(documentoService.listarDePersona(personaId));
    }

    @GetMapping("/documentos/{id}")
    public DocumentoResponse obtener(@PathVariable Long id) {
        return documentoService.obtener(id);
    }

    /** RF-24: sube el numero de version y deja el documento pendiente de validar. */
    @PostMapping(value = "/documentos/{id}/version", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentoCreadoResponse> nuevaVersion(@PathVariable Long id,
                                                                @RequestPart MultipartFile archivo) {
        return ResponseEntity.status(HttpStatus.CREATED).body(documentoService.nuevaVersion(id, archivo));
    }

    /**
     * El binario del documento, para verlo en pantalla.
     *
     * <p>Va {@code inline} y no {@code attachment}: quien valida necesita
     * mirarlo, no bajarlo. El navegador igual deja guardarlo si quiere.
     */
    @GetMapping("/documentos/{id}/archivo")
    public ResponseEntity<Resource> archivo(@PathVariable Long id) {
        DocumentoService.ArchivoDeDocumento archivo = documentoService.archivoDe(id);
        return ResponseEntity.ok()
                .contentType(archivo.tipo())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(archivo.nombre()).build().toString())
                .body(archivo.recurso());
    }

    @PatchMapping("/documentos/{id}/validar")
    public DocumentoValidadoResponse validar(@PathVariable Long id,
                                             @Valid @RequestBody ValidarDocumentoRequest request) {
        return documentoService.validar(id, request);
    }
}

package ar.edu.uade.ciudadanos.documentacion.almacenamiento;

import org.springframework.web.multipart.MultipartFile;

/**
 * Donde van a parar los archivos de los documentos.
 *
 * <p>Esta como interfaz para que mudarse a S3/MinIO sea cambiar la
 * implementacion y no tocar {@code DocumentoService}.
 */
public interface AlmacenamientoArchivos {

    /**
     * Guarda el archivo de una version concreta de un documento.
     *
     * @return referencia con la que despues se recupera (se persiste en
     *         {@code documento.url_archivo})
     */
    String guardar(MultipartFile archivo, Long documentoId, int version);
}

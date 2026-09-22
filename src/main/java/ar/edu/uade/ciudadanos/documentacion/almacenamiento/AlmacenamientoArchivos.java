package ar.edu.uade.ciudadanos.documentacion.almacenamiento;

import org.springframework.core.io.Resource;
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

    /**
     * Recupera el archivo guardado bajo esa referencia.
     *
     * <p>Sin esto se podia subir documentacion pero nadie podia abrirla: el
     * empleado que tiene que validar un documento aprobaba o rechazaba a
     * ciegas.
     *
     * @param referencia lo que devolvio {@link #guardar}, tal cual quedo en
     *                   {@code documento.url_archivo}
     * @throws ar.edu.uade.ciudadanos.common.ApiException 404 si el archivo ya no esta
     */
    Resource leer(String referencia);
}

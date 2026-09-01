package ar.edu.uade.ciudadanos.documentacion.almacenamiento;

import ar.edu.uade.ciudadanos.common.ApiException;
import java.util.Set;
import org.springframework.web.multipart.MultipartFile;

/**
 * Lista blanca de archivos que se aceptan como documentacion.
 *
 * <p>Se validan extension Y content-type: el navegador manda el content-type y
 * es facil de falsear, asi que por si solo no alcanza para decidir que se
 * guarda en el servidor.
 */
public final class ArchivosPermitidos {

    private static final Set<String> EXTENSIONES = Set.of(".pdf", ".jpg", ".jpeg", ".png", ".webp");

    private static final Set<String> CONTENT_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png", "image/webp");

    private ArchivosPermitidos() {
    }

    /** @throws ApiException 400 si el archivo falta, esta vacio o no esta permitido */
    public static void exigirValido(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw ApiException.invalido("archivo es obligatorio y no puede estar vacio");
        }

        String nombre = archivo.getOriginalFilename();
        if (nombre == null || nombre.isBlank()) {
            throw ApiException.invalido("El archivo no tiene nombre");
        }
        // Un nombre con separadores es un intento de escribir fuera del directorio.
        if (nombre.contains("..") || nombre.contains("/") || nombre.contains("\\")) {
            throw ApiException.invalido("El nombre del archivo tiene caracteres no permitidos");
        }

        int punto = nombre.lastIndexOf('.');
        String extension = punto < 0 ? "" : nombre.substring(punto).toLowerCase();
        if (!EXTENSIONES.contains(extension)) {
            throw ApiException.invalido(
                    "Extension no permitida: '" + extension + "'. Permitidas: " + String.join(", ", EXTENSIONES));
        }

        String contentType = archivo.getContentType();
        if (contentType == null || !CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw ApiException.invalido(
                    "Tipo de contenido no permitido: '" + contentType + "'. Permitidos: "
                            + String.join(", ", CONTENT_TYPES));
        }
    }
}

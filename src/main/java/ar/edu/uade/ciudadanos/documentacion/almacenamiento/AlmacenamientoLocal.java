package ar.edu.uade.ciudadanos.documentacion.almacenamiento;

import ar.edu.uade.ciudadanos.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Implementacion de arranque: escribe en el disco local, bajo
 * {@code app.almacenamiento.directorio}.
 *
 * <p>Sirve para desarrollo y para un unico nodo. Con mas de una instancia hace
 * falta almacenamiento compartido (S3/MinIO): ver README.
 */
@Component
public class AlmacenamientoLocal implements AlmacenamientoArchivos {

    private static final Logger log = LoggerFactory.getLogger(AlmacenamientoLocal.class);

    private final Path raiz;

    public AlmacenamientoLocal(@Value("${app.almacenamiento.directorio}") String directorio) {
        this.raiz = Path.of(directorio).toAbsolutePath().normalize();
    }

    @Override
    public String guardar(MultipartFile archivo, Long documentoId, int version) {
        // Nombre derivado del id y la version: nunca se pisan archivos, y las
        // versiones viejas quedan en disco aunque la fila solo guarde la ultima.
        String nombre = "documento-" + documentoId + "-v" + version + extensionDe(archivo);
        Path destino = raiz.resolve(nombre);

        try {
            Files.createDirectories(raiz);
            try (InputStream entrada = archivo.getInputStream()) {
                Files.copy(entrada, destino, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("No se pudo guardar el archivo del documento {} v{}", documentoId, version, e);
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "No se pudo almacenar el archivo");
        }

        return destino.toUri().toString();
    }

    /** Toma la extension del nombre original, ya validado contra lista blanca. */
    private String extensionDe(MultipartFile archivo) {
        String original = archivo.getOriginalFilename();
        if (original == null) {
            return "";
        }
        int punto = original.lastIndexOf('.');
        return punto < 0 ? "" : original.substring(punto).toLowerCase();
    }
}

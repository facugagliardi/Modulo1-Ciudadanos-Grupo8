package ar.edu.uade.ciudadanos.documentacion.almacenamiento;

import ar.edu.uade.ciudadanos.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.FileSystemNotFoundException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
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

    /**
     * {@inheritDoc}
     *
     * <p>Antes de abrir nada se comprueba que la ruta caiga bajo el directorio
     * raiz. La referencia viene de la base, y si alguien lograra escribir ahi
     * un {@code file:///etc/passwd} este metodo lo serviria sin chistar: el
     * endpoint que lo usa esta autenticado, pero autenticado no quiere decir
     * autorizado a leer el disco del servidor.
     */
    @Override
    public Resource leer(String referencia) {
        if (referencia == null || referencia.isBlank()) {
            throw ApiException.noEncontrado("El documento no tiene archivo asociado");
        }

        Path archivo;
        try {
            archivo = Path.of(URI.create(referencia)).toAbsolutePath().normalize();
        } catch (IllegalArgumentException | FileSystemNotFoundException e) {
            log.error("Referencia de archivo ilegible: {}", referencia, e);
            throw ApiException.noEncontrado("No se pudo ubicar el archivo del documento");
        }

        if (!archivo.startsWith(raiz)) {
            log.error("Referencia fuera del directorio de almacenamiento: {}", archivo);
            throw ApiException.noEncontrado("No se pudo ubicar el archivo del documento");
        }

        Resource recurso = new FileSystemResource(archivo);
        if (!recurso.exists() || !recurso.isReadable()) {
            // El archivo estaba y ya no: la fila quedo apuntando a la nada.
            throw ApiException.noEncontrado("El archivo del documento ya no esta disponible");
        }
        return recurso;
    }

    /**
     * El content-type con el que se devuelve el archivo.
     *
     * <p>Sale de la extension y no de lo que declaro el navegador al subirlo:
     * eso ni siquiera se guarda, y ademas es falseable. La lista es la misma
     * que acepta {@link ArchivosPermitidos}, asi que no puede salir de aca algo
     * que no se haya dejado entrar.
     */
    public static MediaType tipoDe(String referencia) {
        String ruta = referencia == null ? "" : referencia.toLowerCase();
        if (ruta.endsWith(".pdf")) return MediaType.APPLICATION_PDF;
        if (ruta.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (ruta.endsWith(".jpg") || ruta.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
        if (ruta.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.APPLICATION_OCTET_STREAM;
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

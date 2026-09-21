package ar.edu.uade.ciudadanos.documentacion.almacenamiento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.edu.uade.ciudadanos.common.ApiException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

class AlmacenamientoLocalTest {

    @TempDir
    Path raiz;

    private AlmacenamientoLocal almacenamiento() {
        return new AlmacenamientoLocal(raiz.toString());
    }

    @Test
    void loQueSeGuardaSePuedeVolverALeer() throws IOException {
        var archivo = new MockMultipartFile("archivo", "cedula.pdf", "application/pdf",
                "contenido".getBytes());

        String referencia = almacenamiento().guardar(archivo, 7L, 1);
        Resource recurso = almacenamiento().leer(referencia);

        assertThat(recurso.exists()).isTrue();
        assertThat(recurso.getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .isEqualTo("contenido");
    }

    /**
     * La referencia sale de la base. Si alguien lograra escribir ahi una ruta
     * cualquiera, este metodo serviria el archivo sin chistar: el endpoint esta
     * autenticado, pero autenticado no es lo mismo que autorizado a leer el
     * disco del servidor.
     */
    @Test
    void noSirveUnArchivoDeFueraDelDirectorio() throws IOException {
        Path intruso = Files.createTempFile("secreto", ".pdf");
        Files.writeString(intruso, "no se deberia poder leer");

        assertThatThrownBy(() -> almacenamiento().leer(intruso.toUri().toString()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));

        Files.deleteIfExists(intruso);
    }

    @Test
    void tampocoSirveUnaRutaQueSubeConDosPuntos() {
        String referencia = raiz.resolve("..").resolve("afuera.pdf").toUri().toString();

        assertThatThrownBy(() -> almacenamiento().leer(referencia))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void siElArchivoYaNoEstaDa404YNoUnErrorDeServidor() {
        String referencia = raiz.resolve("documento-99-v1.pdf").toUri().toString();

        assertThatThrownBy(() -> almacenamiento().leer(referencia))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND))
                .hasMessageContaining("ya no esta disponible");
    }

    @Test
    void unDocumentoSinArchivoDa404() {
        assertThatThrownBy(() -> almacenamiento().leer(null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    /**
     * El tipo sale de la extension y no de lo que declaro el navegador: eso ni
     * se guarda, y ademas es falseable. La lista es la misma que deja entrar
     * {@link ArchivosPermitidos}.
     */
    @Test
    void elTipoSaleDeLaExtension() {
        assertThat(AlmacenamientoLocal.tipoDe("x/doc.pdf")).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(AlmacenamientoLocal.tipoDe("x/foto.JPG")).isEqualTo(MediaType.IMAGE_JPEG);
        assertThat(AlmacenamientoLocal.tipoDe("x/foto.jpeg")).isEqualTo(MediaType.IMAGE_JPEG);
        assertThat(AlmacenamientoLocal.tipoDe("x/foto.png")).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(AlmacenamientoLocal.tipoDe("x/foto.webp"))
                .isEqualTo(MediaType.parseMediaType("image/webp"));
        // Sin extension conocida no se inventa un tipo: octet-stream y que el
        // navegador decida que hacer.
        assertThat(AlmacenamientoLocal.tipoDe("x/cosa.raro"))
                .isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
    }
}

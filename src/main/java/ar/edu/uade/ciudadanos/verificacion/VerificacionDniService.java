package ar.edu.uade.ciudadanos.verificacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.verificacion.dto.CampoVerificado;
import ar.edu.uade.ciudadanos.verificacion.dto.DatosDni;
import ar.edu.uade.ciudadanos.verificacion.dto.DatosIngresados;
import ar.edu.uade.ciudadanos.verificacion.dto.ResultadoVerificacionDni;
import java.io.IOException;
import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Verifica que los datos del formulario de registro coincidan con las fotos
 * del DNI argentino. Groq solo lee; la comparacion es local y deterministica.
 */
@Service
public class VerificacionDniService {

    /** Groq acepta hasta 4 MB de imagen en base64 por request (~3 MB en binario). */
    static final long MAX_BYTES_IMAGEN = 2_500_000;
    private static final Set<String> TIPOS_PERMITIDOS = Set.of("image/jpeg", "image/png", "image/webp");

    private final GroqLectorDni lector;
    private final Clock reloj;

    @Autowired
    public VerificacionDniService(GroqLectorDni lector) {
        this(lector, Clock.systemDefaultZone());
    }

    VerificacionDniService(GroqLectorDni lector, Clock reloj) {
        this.lector = lector;
        this.reloj = reloj;
    }

    /** {@code imagen}: frente y dorso unidos en una sola foto, frente arriba y dorso abajo. */
    public ResultadoVerificacionDni verificar(DatosIngresados ingresados, MultipartFile imagen) {
        DatosDni leido = lector.leer(imagen(imagen));
        return comparar(ingresados, leido);
    }

    ResultadoVerificacionDni comparar(DatosIngresados ingresados, DatosDni leido) {
        List<String> problemas = new ArrayList<>();
        if (!leido.esDniArgentino()) {
            problemas.add("Las fotos no parecen ser el frente y el dorso de un DNI argentino.");
        }
        if (!leido.frenteLegible()) {
            problemas.add("No se pudo leer bien el frente. Proba con mas luz, sin reflejos y con el DNI entero en la foto.");
        }
        if (!leido.dorsoLegible()) {
            problemas.add("No se pudo leer bien el dorso. Proba con mas luz, sin reflejos y con el DNI entero en la foto.");
        }
        if (leido.fechaVencimiento() != null && leido.fechaVencimiento().isBefore(LocalDate.now(reloj))) {
            problemas.add("El DNI esta vencido desde el " + leido.fechaVencimiento() + ".");
        }

        List<CampoVerificado> campos = List.of(
                texto("apellido", "Apellido", ingresados.apellido(), leido.apellido()),
                texto("nombre", "Nombre", ingresados.nombre(), leido.nombre()),
                dni(ingresados.dni(), leido.numeroDocumento()),
                fechaNacimiento(ingresados.fechaNacimiento(), leido.fechaNacimiento()),
                cuil(ingresados.cuil(), ingresados.dni(), leido.cuil()),
                texto("nacionalidad", "Nacionalidad", ingresados.nacionalidad(), leido.nacionalidad()));

        boolean coincide = problemas.isEmpty() && campos.stream().allMatch(CampoVerificado::coincide);
        return new ResultadoVerificacionDni(coincide, campos, problemas, leido);
    }

    // ------------------------------------------------------------- comparadores

    private static CampoVerificado texto(String campo, String etiqueta, String ingresado, String leido) {
        if (leido == null) {
            return noLeido(campo, etiqueta, ingresado);
        }
        boolean coincide = normalizar(ingresado).equals(normalizar(leido));
        return new CampoVerificado(campo, etiqueta, ingresado, leido, coincide,
                coincide ? null : "Tiene que estar escrito igual que en el DNI (las tildes no importan).");
    }

    private static CampoVerificado dni(String ingresado, String leido) {
        if (leido == null) {
            return noLeido("dni", "DNI", ingresado);
        }
        boolean coincide = sinCerosIzquierda(digitos(ingresado)).equals(sinCerosIzquierda(leido));
        return new CampoVerificado("dni", "DNI", ingresado, leido, coincide, null);
    }

    private static CampoVerificado fechaNacimiento(LocalDate ingresada, LocalDate leida) {
        String texto = ingresada == null ? null : ingresada.toString();
        if (leida == null) {
            return noLeido("fechaNacimiento", "Fecha de nacimiento", texto);
        }
        return new CampoVerificado("fechaNacimiento", "Fecha de nacimiento", texto, leida.toString(),
                leida.equals(ingresada), null);
    }

    /**
     * El CUIL esta en el dorso de los DNI tarjeta. Si no se pudo leer, al menos
     * se exige que el CUIL tipeado contenga el DNI (los 8 digitos del medio).
     */
    private static CampoVerificado cuil(String ingresado, String dniIngresado, String leido) {
        String cuil = digitos(ingresado);
        if (leido != null) {
            return new CampoVerificado("cuil", "CUIL", ingresado, leido, cuil.equals(leido), null);
        }
        boolean contieneDni = cuil.length() == 11
                && sinCerosIzquierda(cuil.substring(2, 10)).equals(sinCerosIzquierda(digitos(dniIngresado)));
        return new CampoVerificado("cuil", "CUIL", ingresado, null, contieneDni,
                contieneDni ? "No se leyo en el dorso; se verifico que contenga tu DNI."
                            : "No se leyo en el dorso, y el CUIL ingresado no contiene tu DNI.");
    }

    private static CampoVerificado noLeido(String campo, String etiqueta, String ingresado) {
        return new CampoVerificado(campo, etiqueta, ingresado, null, false,
                "No se pudo leer en la foto.");
    }

    /** Mayusculas, sin tildes y con un solo espacio entre palabras: "Peña  García" -> "PENA GARCIA". */
    static String normalizar(String valor) {
        if (valor == null) {
            return "";
        }
        String sinTildes = Normalizer.normalize(valor, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return sinTildes.toUpperCase(Locale.ROOT).replaceAll("[^A-Z]+", " ").trim();
    }

    private static String digitos(String valor) {
        return valor == null ? "" : valor.replaceAll("\\D", "");
    }

    private static String sinCerosIzquierda(String valor) {
        String limpio = valor.replaceFirst("^0+", "");
        return limpio.isEmpty() ? valor : limpio;
    }

    // ----------------------------------------------------------------- imagenes

    private static GroqLectorDni.Imagen imagen(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw ApiException.invalido("Falta la foto del DNI");
        }
        String tipo = Objects.requireNonNullElse(archivo.getContentType(), "").toLowerCase(Locale.ROOT);
        if (!TIPOS_PERMITIDOS.contains(tipo)) {
            throw ApiException.invalido("La foto del DNI tiene que ser JPG, PNG o WEBP");
        }
        if (archivo.getSize() > MAX_BYTES_IMAGEN) {
            throw ApiException.invalido("La foto del DNI pesa demasiado (maximo 2,5 MB)");
        }
        try {
            return new GroqLectorDni.Imagen(tipo, archivo.getBytes());
        } catch (IOException e) {
            throw ApiException.invalido("No se pudo leer la foto del DNI");
        }
    }
}

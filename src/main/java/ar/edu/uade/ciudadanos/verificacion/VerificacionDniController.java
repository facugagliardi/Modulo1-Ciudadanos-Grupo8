package ar.edu.uade.ciudadanos.verificacion;

import ar.edu.uade.ciudadanos.verificacion.dto.DatosIngresados;
import ar.edu.uade.ciudadanos.verificacion.dto.ResultadoVerificacionDni;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Verificacion del DNI argentino antes del registro. Es publica (cae bajo
 * /auth/**) porque se usa antes de que exista la cuenta.
 */
@RestController
public class VerificacionDniController {

    private final VerificacionDniService verificacionDniService;

    public VerificacionDniController(VerificacionDniService verificacionDniService) {
        this.verificacionDniService = verificacionDniService;
    }

    @PostMapping(value = "/auth/verificar-dni", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResultadoVerificacionDni verificar(
            /** Una sola foto: frente del DNI arriba, dorso abajo. */
            @RequestPart MultipartFile imagen,
            @RequestParam String dni,
            @RequestParam String cuil,
            @RequestParam String nombre,
            @RequestParam String apellido,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaNacimiento,
            @RequestParam String nacionalidad) {
        return verificacionDniService.verificar(
                new DatosIngresados(dni, cuil, nombre, apellido, fechaNacimiento, nacionalidad), imagen);
    }
}

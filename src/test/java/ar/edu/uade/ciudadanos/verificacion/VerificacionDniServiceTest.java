package ar.edu.uade.ciudadanos.verificacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.verificacion.dto.CampoVerificado;
import ar.edu.uade.ciudadanos.verificacion.dto.DatosDni;
import ar.edu.uade.ciudadanos.verificacion.dto.DatosIngresados;
import ar.edu.uade.ciudadanos.verificacion.dto.ResultadoVerificacionDni;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class VerificacionDniServiceTest {

    private static final Clock HOY = Clock.fixed(Instant.parse("2026-11-15T12:00:00Z"), ZoneOffset.UTC);

    private final GroqLectorDni lector = mock(GroqLectorDni.class);
    private final VerificacionDniService servicio = new VerificacionDniService(lector, HOY);

    private static DatosIngresados ingresados() {
        return new DatosIngresados("34567890", "20-34567890-1", "Juan Pablo", "Peña García",
                LocalDate.of(1990, 1, 15), "Argentina");
    }

    private static DatosDni leidoOk() {
        return new DatosDni(true, true, true, "PEÑA GARCÍA", "JUAN PABLO", "34567890", "M", "ARGENTINA",
                LocalDate.of(1990, 1, 15), LocalDate.of(2031, 3, 1), "20345678901", "");
    }

    private static CampoVerificado campo(ResultadoVerificacionDni r, String nombre) {
        return r.campos().stream().filter(c -> c.campo().equals(nombre)).findFirst().orElseThrow();
    }

    @Test
    void coincideIgnorandoTildesMayusculasYFormatos() {
        ResultadoVerificacionDni r = servicio.comparar(ingresados(), leidoOk());

        assertThat(r.coincide()).isTrue();
        assertThat(r.problemas()).isEmpty();
        assertThat(r.campos()).allMatch(CampoVerificado::coincide);
    }

    @Test
    void nombreIncompletoNoCoincide() {
        DatosIngresados soloPrimerNombre = new DatosIngresados("34567890", "20345678901", "Juan", "Peña García",
                LocalDate.of(1990, 1, 15), "Argentina");

        ResultadoVerificacionDni r = servicio.comparar(soloPrimerNombre, leidoOk());

        assertThat(r.coincide()).isFalse();
        assertThat(campo(r, "nombre").coincide()).isFalse();
        assertThat(campo(r, "nombre").leido()).isEqualTo("JUAN PABLO");
    }

    @Test
    void fechaDeNacimientoDistintaNoCoincide() {
        DatosIngresados otraFecha = new DatosIngresados("34567890", "20345678901", "Juan Pablo", "Peña García",
                LocalDate.of(1990, 1, 16), "Argentina");

        assertThat(campo(servicio.comparar(otraFecha, leidoOk()), "fechaNacimiento").coincide()).isFalse();
    }

    @Test
    void dniConCerosAdelanteCoincide() {
        DatosIngresados conCero = new DatosIngresados("07123456", "20071234561", "Juan Pablo", "Peña García",
                LocalDate.of(1990, 1, 15), "Argentina");
        DatosDni leido = new DatosDni(true, true, true, "PEÑA GARCÍA", "JUAN PABLO", "7123456", "M", "ARGENTINA",
                LocalDate.of(1990, 1, 15), null, null, "");

        ResultadoVerificacionDni r = servicio.comparar(conCero, leido);

        assertThat(campo(r, "dni").coincide()).isTrue();
        assertThat(campo(r, "cuil").coincide()).as("CUIL no leido pero contiene el DNI").isTrue();
        assertThat(r.coincide()).isTrue();
    }

    @Test
    void cuilNoLeidoQueNoContieneElDniNoCoincide() {
        DatosIngresados cuilAjeno = new DatosIngresados("34567890", "20111111112", "Juan Pablo", "Peña García",
                LocalDate.of(1990, 1, 15), "Argentina");
        DatosDni sinCuil = new DatosDni(true, true, true, "PEÑA GARCÍA", "JUAN PABLO", "34567890", "M", "ARGENTINA",
                LocalDate.of(1990, 1, 15), null, null, "");

        assertThat(campo(servicio.comparar(cuilAjeno, sinCuil), "cuil").coincide()).isFalse();
    }

    @Test
    void campoNoLeidoNoCoincide() {
        DatosDni sinApellido = new DatosDni(true, true, true, null, "JUAN PABLO", "34567890", "M", "ARGENTINA",
                LocalDate.of(1990, 1, 15), null, "20345678901", "");

        ResultadoVerificacionDni r = servicio.comparar(ingresados(), sinApellido);

        assertThat(r.coincide()).isFalse();
        assertThat(campo(r, "apellido").detalle()).contains("No se pudo leer");
    }

    @Test
    void dniVencidoOQueNoEsDniArgentinoNoPasa() {
        DatosDni vencido = new DatosDni(true, true, true, "PEÑA GARCÍA", "JUAN PABLO", "34567890", "M", "ARGENTINA",
                LocalDate.of(1990, 1, 15), LocalDate.of(2025, 1, 1), "20345678901", "");
        DatosDni pasaporte = new DatosDni(false, true, true, "PEÑA GARCÍA", "JUAN PABLO", "34567890", "M", "ARGENTINA",
                LocalDate.of(1990, 1, 15), null, "20345678901", "");

        assertThat(servicio.comparar(ingresados(), vencido).problemas()).anyMatch(p -> p.contains("vencido"));
        assertThat(servicio.comparar(ingresados(), vencido).coincide()).isFalse();
        assertThat(servicio.comparar(ingresados(), pasaporte).coincide()).isFalse();
    }

    @Test
    void rechazaFotosQueNoSonImagenSinLlamarAGroq() {
        MockMultipartFile pdf = new MockMultipartFile("imagen", "dni.pdf", "application/pdf", new byte[]{1});

        assertThatThrownBy(() -> servicio.verificar(ingresados(), pdf))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("JPG");
        verify(lector, never()).leer(any());
    }

    @Test
    void interpretaLaRespuestaDeGroq() {
        GroqLectorDni real = new GroqLectorDni(new ObjectMapper(), "clave", "modelo", "none", "http://localhost");
        String contenido = """
                {"es_dni_argentino": true, "frente_legible": true, "dorso_legible": true,
                 "apellido": "PEÑA", "nombre": "JUAN", "numero_documento": "34.567.890", "sexo": "M",
                 "nacionalidad": "ARGENTINA", "fecha_nacimiento": "1990-01-15", "fecha_vencimiento": "no se ve",
                 "cuil": "20-34567890-1", "observaciones": ""}""";
        String respuesta = new ObjectMapper().createObjectNode()
                .set("choices", new ObjectMapper().createArrayNode().add(new ObjectMapper().createObjectNode()
                        .set("message", new ObjectMapper().createObjectNode().put("content", contenido))))
                .toString();

        DatosDni datos = real.interpretar(respuesta);

        assertThat(datos.numeroDocumento()).isEqualTo("34567890");
        assertThat(datos.cuil()).isEqualTo("20345678901");
        assertThat(datos.fechaNacimiento()).isEqualTo(LocalDate.of(1990, 1, 15));
        assertThat(datos.fechaVencimiento()).isNull();
        assertThat(datos.observaciones()).isNull();
    }
}

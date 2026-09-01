package ar.edu.uade.ciudadanos.common;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.edu.uade.ciudadanos.documentacion.entity.EstadoSolicitud;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import org.junit.jupiter.api.Test;

class TransicionesEstadoTest {

    @Test
    void unCiudadanoActivoPuedeBloquearse() {
        assertThatCode(() -> TransicionesEstado.exigirCiudadano(
                EstadoCiudadano.ACTIVO, EstadoCiudadano.BLOQUEADO)).doesNotThrowAnyException();
    }

    @Test
    void unFallecidoNoVuelveAEstarActivo() {
        assertThatThrownBy(() -> TransicionesEstado.exigirCiudadano(
                EstadoCiudadano.FALLECIDO, EstadoCiudadano.ACTIVO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("estado final");
    }

    @Test
    void pasarAlMismoEstadoNoEsUnaTransicion() {
        assertThatThrownBy(() -> TransicionesEstado.exigirCiudadano(
                EstadoCiudadano.ACTIVO, EstadoCiudadano.ACTIVO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ya esta en estado ACTIVO");
    }

    @Test
    void unaRepresentacionRevocadaNoSeReactiva() {
        assertThatThrownBy(() -> TransicionesEstado.exigirRepresentacion(
                EstadoRepresentacion.REVOCADA, EstadoRepresentacion.VIGENTE))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void unaSolicitudVencidaTodaviaPuedeCumplirse() {
        assertThatCode(() -> TransicionesEstado.exigirSolicitud(
                EstadoSolicitud.VENCIDA, EstadoSolicitud.CUMPLIDA)).doesNotThrowAnyException();
    }

    @Test
    void unExpedienteIniciadoNoSaltaDirectoAResuelto() {
        assertThatThrownBy(() -> TransicionesEstado.exigirExpediente(
                EstadoExpediente.INICIADO, EstadoExpediente.RESUELTO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Destinos permitidos")
                .hasMessageContaining("EN_TRAMITE");
    }

    @Test
    void unExpedienteArchivadoEsTerminal() {
        assertThatThrownBy(() -> TransicionesEstado.exigirExpediente(
                EstadoExpediente.ARCHIVADO, EstadoExpediente.EN_TRAMITE))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("estado final");
    }
}

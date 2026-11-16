package ar.edu.uade.ciudadanos.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.edu.uade.ciudadanos.documentacion.entity.EstadoSolicitud;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

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
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("estado final");
    }

    @Test
    void pasarAlMismoEstadoNoEsUnaTransicion() {
        assertThatThrownBy(() -> TransicionesEstado.exigirCiudadano(
                EstadoCiudadano.ACTIVO, EstadoCiudadano.ACTIVO))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("ya esta en estado ACTIVO");
    }

    @Test
    void unaRepresentacionRevocadaNoSeReactiva() {
        assertThatThrownBy(() -> TransicionesEstado.exigirRepresentacion(
                EstadoRepresentacion.REVOCADA, EstadoRepresentacion.VIGENTE))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void unaSolicitudVencidaTodaviaPuedeCumplirse() {
        assertThatCode(() -> TransicionesEstado.exigirSolicitud(
                EstadoSolicitud.VENCIDA, EstadoSolicitud.CUMPLIDA)).doesNotThrowAnyException();
    }

    @Test
    void unaOrganizacionActivaPuedeInactivarse() {
        assertThatCode(() -> TransicionesEstado.exigirOrganizacion(
                EstadoOrganizacion.ACTIVA, EstadoOrganizacion.INACTIVA)).doesNotThrowAnyException();
    }

    @Test
    void unaOrganizacionNoPuedePasarAUnEstadoInvalido() {
        assertThatThrownBy(() -> TransicionesEstado.exigirOrganizacion(
                EstadoOrganizacion.ACTIVA, EstadoOrganizacion.PENDIENTE))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("Transicion invalida");
    }

    @Test
    void unExpedienteIniciadoNoSaltaDirectoAResuelto() {
        assertThatThrownBy(() -> TransicionesEstado.exigirExpediente(
                EstadoExpediente.INICIADO, EstadoExpediente.RESUELTO))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("Destinos permitidos")
                .hasMessageContaining("EN_TRAMITE");
    }

    @Test
    void unExpedienteArchivadoEsTerminal() {
        assertThatThrownBy(() -> TransicionesEstado.exigirExpediente(
                EstadoExpediente.ARCHIVADO, EstadoExpediente.EN_TRAMITE))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("estado final");
    }
}

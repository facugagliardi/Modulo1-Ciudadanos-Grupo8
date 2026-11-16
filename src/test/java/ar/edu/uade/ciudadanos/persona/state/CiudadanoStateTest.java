package ar.edu.uade.ciudadanos.persona.state;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CiudadanoStateTest {

    @Test
    @DisplayName("ActivoState permite transicionar a Inactivo, Bloqueado y Fallecido")
    void activoStateTransicionesValidas() {
        CiudadanoState estado = new ActivoState();
        assertThat(estado.getEstado()).isEqualTo(EstadoCiudadano.ACTIVO);
        assertThat(estado.esTerminal()).isFalse();
        assertThat(estado.getTransicionesPermitidas()).containsExactlyInAnyOrder(
                EstadoCiudadano.INACTIVO,
                EstadoCiudadano.BLOQUEADO,
                EstadoCiudadano.FALLECIDO
        );

        assertThat(estado.cambiarEstado(EstadoCiudadano.INACTIVO)).isInstanceOf(InactivoState.class);
        assertThat(estado.cambiarEstado(EstadoCiudadano.BLOQUEADO)).isInstanceOf(BloqueadoState.class);
        assertThat(estado.cambiarEstado(EstadoCiudadano.FALLECIDO)).isInstanceOf(FallecidoState.class);
    }

    @Test
    @DisplayName("ActivoState rechaza transicion a si mismo")
    void activoStateRechazaMismoEstado() {
        CiudadanoState estado = new ActivoState();
        assertThatThrownBy(() -> estado.cambiarEstado(EstadoCiudadano.ACTIVO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ya esta en estado ACTIVO");
    }

    @Test
    @DisplayName("InactivoState permite reactivacion a Activo, o paso a Bloqueado y Fallecido")
    void inactivoStateTransicionesValidas() {
        CiudadanoState estado = new InactivoState();
        assertThat(estado.getEstado()).isEqualTo(EstadoCiudadano.INACTIVO);
        assertThat(estado.esTerminal()).isFalse();

        assertThat(estado.cambiarEstado(EstadoCiudadano.ACTIVO)).isInstanceOf(ActivoState.class);
        assertThat(estado.cambiarEstado(EstadoCiudadano.BLOQUEADO)).isInstanceOf(BloqueadoState.class);
        assertThat(estado.cambiarEstado(EstadoCiudadano.FALLECIDO)).isInstanceOf(FallecidoState.class);
    }

    @Test
    @DisplayName("BloqueadoState permite rehabilitacion a Activo, Inactivo o Fallecido")
    void bloqueadoStateTransicionesValidas() {
        CiudadanoState estado = new BloqueadoState();
        assertThat(estado.getEstado()).isEqualTo(EstadoCiudadano.BLOQUEADO);
        assertThat(estado.esTerminal()).isFalse();

        assertThat(estado.cambiarEstado(EstadoCiudadano.ACTIVO)).isInstanceOf(ActivoState.class);
        assertThat(estado.cambiarEstado(EstadoCiudadano.INACTIVO)).isInstanceOf(InactivoState.class);
        assertThat(estado.cambiarEstado(EstadoCiudadano.FALLECIDO)).isInstanceOf(FallecidoState.class);
    }

    @Test
    @DisplayName("FallecidoState es terminal y rechaza cualquier transicion")
    void fallecidoStateEsTerminal() {
        CiudadanoState estado = new FallecidoState();
        assertThat(estado.getEstado()).isEqualTo(EstadoCiudadano.FALLECIDO);
        assertThat(estado.esTerminal()).isTrue();
        assertThat(estado.getTransicionesPermitidas()).isEmpty();

        assertThatThrownBy(() -> estado.cambiarEstado(EstadoCiudadano.ACTIVO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("estado final");

        assertThatThrownBy(() -> estado.cambiarEstado(EstadoCiudadano.INACTIVO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("estado final");

        assertThatThrownBy(() -> estado.cambiarEstado(EstadoCiudadano.BLOQUEADO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("estado final");
    }

    @Test
    @DisplayName("Rechaza nuevo estado nulo")
    void rechazaEstadoNulo() {
        CiudadanoState estado = new ActivoState();
        assertThatThrownBy(() -> estado.cambiarEstado(null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no puede ser nulo");
    }

    @Test
    @DisplayName("Factory CiudadanoState.de resuelve el estado correspondiente")
    void factoryResuelveEstados() {
        assertThat(CiudadanoState.de(EstadoCiudadano.ACTIVO)).isInstanceOf(ActivoState.class);
        assertThat(CiudadanoState.de(EstadoCiudadano.INACTIVO)).isInstanceOf(InactivoState.class);
        assertThat(CiudadanoState.de(EstadoCiudadano.BLOQUEADO)).isInstanceOf(BloqueadoState.class);
        assertThat(CiudadanoState.de(EstadoCiudadano.FALLECIDO)).isInstanceOf(FallecidoState.class);
        assertThat(CiudadanoState.de(null)).isInstanceOf(ActivoState.class);
    }

    @Test
    @DisplayName("Entidad Ciudadano delega su transicion al patron State")
    void ciudadanoEntidadDelegaEnState() {
        Ciudadano ciudadano = new Ciudadano();
        assertThat(ciudadano.getEstado()).isEqualTo(EstadoCiudadano.ACTIVO);
        assertThat(ciudadano.getState()).isInstanceOf(ActivoState.class);

        ciudadano.cambiarEstado(EstadoCiudadano.BLOQUEADO);
        assertThat(ciudadano.getEstado()).isEqualTo(EstadoCiudadano.BLOQUEADO);
        assertThat(ciudadano.getState()).isInstanceOf(BloqueadoState.class);

        ciudadano.cambiarEstado(EstadoCiudadano.FALLECIDO);
        assertThat(ciudadano.getEstado()).isEqualTo(EstadoCiudadano.FALLECIDO);
        assertThat(ciudadano.getState()).isInstanceOf(FallecidoState.class);

        assertThatThrownBy(() -> ciudadano.cambiarEstado(EstadoCiudadano.ACTIVO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("estado final");
    }
}

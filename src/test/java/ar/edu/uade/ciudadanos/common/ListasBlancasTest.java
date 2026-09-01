package ar.edu.uade.ciudadanos.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ListasBlancasTest {

    @Test
    void normalizaAMayusculasYRecortaEspacios() {
        assertThat(ListasBlancas.exigir("  padre ", ListasBlancas.TIPOS_RELACION, "tipo")).isEqualTo("PADRE");
    }

    @Test
    void unValorFueraDeLaListaDa400YEnumeraLosPermitidos() {
        assertThatThrownBy(() -> ListasBlancas.exigir("PRIMO", ListasBlancas.TIPOS_RELACION, "relacionCiudadano1"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("relacionCiudadano1")
                .hasMessageContaining("PRIMO")
                .hasMessageContaining("Valores permitidos")
                .hasMessageContaining("CONYUGE");
    }

    @Test
    void unValorVacioDa400() {
        assertThatThrownBy(() -> ListasBlancas.exigir("   ", ListasBlancas.TIPOS_PROPIEDAD, "tipo"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("tipo es obligatorio");
    }

    @Test
    void elCampoOpcionalDejaPasarElNull() {
        assertThat(ListasBlancas.exigirSiPresente(null, ListasBlancas.TIPOS_ORGANIZACION, "tipo")).isNull();
    }

    @Test
    void lasListasNoSePuedenModificarDesdeAfuera() {
        assertThatThrownBy(() -> ListasBlancas.TIPOS_DOCUMENTO.add("INVENTADO"))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}

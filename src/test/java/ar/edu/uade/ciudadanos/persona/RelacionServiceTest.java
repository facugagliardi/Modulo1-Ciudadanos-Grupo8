package ar.edu.uade.ciudadanos.persona;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.persona.dto.CrearRelacionRequest;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.Relacion;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.RelacionRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RelacionServiceTest {

    @Mock private RelacionRepository relacionRepository;
    @Mock private CiudadanoRepository ciudadanoRepository;
    @Mock private AutorizacionService autorizacion;

    @InjectMocks private RelacionService relacionService;

    @BeforeEach
    void setUp() {
        when(autorizacion.puede(Permiso.EDITAR_TERCEROS)).thenReturn(true);
        when(ciudadanoRepository.findById(1L)).thenReturn(Optional.of(ciudadano(1L, "Ana", "Diaz")));
        when(ciudadanoRepository.findById(2L)).thenReturn(Optional.of(ciudadano(2L, "Beto", "Diaz")));
        when(relacionRepository.save(any(Relacion.class))).thenAnswer(inv -> {
            Relacion r = inv.getArgument(0);
            r.setRelacionId(100L);
            return r;
        });
    }

    @Test
    void creaLaRelacionNormalizandoLosTipos() {
        var respuesta = relacionService.crear(
                new CrearRelacionRequest(1L, 2L, "madre", "hijo", true));

        assertThat(respuesta.relacionId()).isEqualTo(100L);
        assertThat(respuesta.relacionCiudadano1()).isEqualTo("MADRE");
        assertThat(respuesta.relacionCiudadano2()).isEqualTo("HIJO");
        assertThat(respuesta.esResponsable()).isTrue();
    }

    @Test
    void unTipoDeRelacionFueraDeLaListaBlancaDa400() {
        assertThatThrownBy(() -> relacionService.crear(
                new CrearRelacionRequest(1L, 2L, "CUNADO", "CUNADO", false)))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Valores permitidos");
    }

    @Test
    void nadieSeRelacionaConsigoMismo() {
        assertThatThrownBy(() -> relacionService.crear(
                new CrearRelacionRequest(1L, 1L, "HERMANO", "HERMANO", false)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("consigo mismo");
    }

    @Test
    void unCiudadanoInexistenteDa404() {
        when(ciudadanoRepository.findById(77L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> relacionService.crear(
                new CrearRelacionRequest(1L, 77L, "HERMANO", "HERMANO", false)))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    /** El par es simetrico: si ya existe 2-1, no se puede crear 1-2. */
    @Test
    void unParYaVinculadoDa409AunqueVengaAlReves() {
        when(relacionRepository.findByCiudadanoId1AndCiudadanoId2(2L, 1L))
                .thenReturn(Optional.of(new Relacion()));

        assertThatThrownBy(() -> relacionService.crear(
                new CrearRelacionRequest(1L, 2L, "HERMANO", "HERMANA", false)))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    /**
     * Mirando desde el ciudadano 2, el tipo que corresponde es el del extremo 1
     * (que es MADRE), no el propio.
     */
    @Test
    void elListadoDevuelveElTipoDelOtroExtremo() {
        Relacion relacion = new Relacion();
        relacion.setRelacionId(100L);
        relacion.setCiudadanoId1(1L);
        relacion.setCiudadanoId2(2L);
        relacion.setRelacionCiudadano1("MADRE");
        relacion.setRelacionCiudadano2("HIJO");
        when(relacionRepository.findByCiudadanoId1OrCiudadanoId2(2L, 2L)).thenReturn(List.of(relacion));
        when(ciudadanoRepository.existsById(2L)).thenReturn(true);

        var items = relacionService.listarDe(2L);

        assertThat(items).singleElement().satisfies(item -> {
            assertThat(item.ciudadanoRelacionadoId()).isEqualTo(1L);
            assertThat(item.tipoRelacion()).isEqualTo("MADRE");
            assertThat(item.nombre()).isEqualTo("Ana");
        });
    }

    private Ciudadano ciudadano(Long id, String nombre, String apellido) {
        Ciudadano c = new Ciudadano();
        c.setId(id);
        c.setNombre(nombre);
        c.setApellido(apellido);
        return c;
    }
}

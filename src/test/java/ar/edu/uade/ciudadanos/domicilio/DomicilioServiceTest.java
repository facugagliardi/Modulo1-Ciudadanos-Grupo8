package ar.edu.uade.ciudadanos.domicilio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.domicilio.dto.CrearDomicilioRequest;
import ar.edu.uade.ciudadanos.domicilio.entity.CiudadanoPropiedad;
import ar.edu.uade.ciudadanos.domicilio.entity.CiudadanoPropiedadId;
import ar.edu.uade.ciudadanos.domicilio.entity.Propiedad;
import ar.edu.uade.ciudadanos.domicilio.repository.CiudadanoPropiedadRepository;
import ar.edu.uade.ciudadanos.domicilio.repository.PropiedadRepository;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.time.LocalDate;
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
class DomicilioServiceTest {

    private static final Long PERSONA = 1L;

    @Mock private PropiedadRepository propiedadRepository;
    @Mock private CiudadanoPropiedadRepository vinculoRepository;
    @Mock private CiudadanoRepository ciudadanoRepository;
    @Mock private AutorizacionService autorizacion;

    @InjectMocks private DomicilioService domicilioService;

    @BeforeEach
    void setUp() {
        when(ciudadanoRepository.existsById(PERSONA)).thenReturn(true);
        when(autorizacion.puede(Permiso.EDITAR_TERCEROS)).thenReturn(true);
        when(propiedadRepository.save(any(Propiedad.class))).thenAnswer(inv -> {
            Propiedad p = inv.getArgument(0);
            if (p.getPropiedadId() == null) {
                p.setPropiedadId(10L);
            }
            return p;
        });
    }

    private CrearDomicilioRequest request(Boolean esPrincipal) {
        return new CrearDomicilioRequest("CASA", "Av Siempre Viva", "742", null, null, null, null, esPrincipal);
    }

    @Test
    void elPrimerDomicilioQuedaComoPrincipalAunqueNoSePida() {
        when(vinculoRepository.findByIdIdCiudadanoAndEsPrincipalTrueAndVigenteHastaIsNull(PERSONA))
                .thenReturn(Optional.empty());

        var respuesta = domicilioService.crear(PERSONA, request(null));

        assertThat(respuesta.esPrincipal()).isTrue();
        assertThat(respuesta.propiedadId()).isEqualTo(10L);
    }

    @Test
    void unSegundoDomicilioNoRobaElPrincipalSiNoSePide() {
        when(vinculoRepository.findByIdIdCiudadanoAndEsPrincipalTrueAndVigenteHastaIsNull(PERSONA))
                .thenReturn(Optional.of(vinculo(9L, true, null)));

        assertThat(domicilioService.crear(PERSONA, request(null)).esPrincipal()).isFalse();
    }

    @Test
    void elTipoSeValidaContraListaBlanca() {
        var invalido = new CrearDomicilioRequest("CASTILLO", "Calle", "1", null, null, null, null, null);

        assertThatThrownBy(() -> domicilioService.crear(PERSONA, invalido))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Valores permitidos")
                .hasMessageContaining("DEPARTAMENTO");
    }

    @Test
    void darDeBajaElUnicoPrincipalDa409() {
        CiudadanoPropiedad unico = vinculo(10L, true, null);
        when(vinculoRepository.findByIdIdPropiedad(10L)).thenReturn(List.of(unico));
        when(vinculoRepository.findByIdIdCiudadanoAndVigenteHastaIsNull(PERSONA)).thenReturn(List.of(unico));

        assertThatThrownBy(() -> domicilioService.darDeBaja(10L))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("unico domicilio principal");
    }

    @Test
    void darDeBajaElPrincipalConReemplazoCierraVigenciaYPromueveElOtro() {
        CiudadanoPropiedad principal = vinculo(10L, true, null);
        CiudadanoPropiedad otro = vinculo(11L, false, null);
        otro.setVigenteDesde(LocalDate.now().minusDays(5));

        when(vinculoRepository.findByIdIdPropiedad(10L)).thenReturn(List.of(principal));
        when(vinculoRepository.findByIdIdCiudadanoAndVigenteHastaIsNull(PERSONA))
                .thenReturn(List.of(principal, otro));
        when(ciudadanoRepository.findById(anyLong())).thenReturn(Optional.empty());

        var respuesta = domicilioService.darDeBaja(10L);

        assertThat(respuesta.vigenteHasta()).isEqualTo(LocalDate.now());
        assertThat(respuesta.nuevoPrincipalId()).isEqualTo(11L);
        assertThat(principal.isEsPrincipal()).isFalse();
        assertThat(otro.isEsPrincipal()).isTrue();
    }

    @Test
    void noSePuedeDarDeBajaDosVecesElMismoDomicilio() {
        CiudadanoPropiedad yaCerrado = vinculo(10L, false, LocalDate.now().minusDays(1));
        when(vinculoRepository.findByIdIdPropiedad(10L)).thenReturn(List.of(yaCerrado));

        assertThatThrownBy(() -> domicilioService.darDeBaja(10L))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ya estaba dado de baja");
    }

    @Test
    void marcarPrincipalUnDomicilioDeOtraPersonaDa403() {
        when(autorizacion.puede(Permiso.EDITAR_TERCEROS)).thenReturn(false);
        when(autorizacion.actual()).thenReturn(new ar.edu.uade.ciudadanos.security.AuthPrincipal(
                99L, ar.edu.uade.ciudadanos.security.TipoSujeto.CIUDADANO, "PERSONA"));
        when(vinculoRepository.findByIdIdPropiedad(10L)).thenReturn(List.of(vinculo(10L, false, null)));

        assertThatThrownBy(() -> domicilioService.marcarPrincipal(10L))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void crearDomicilioConPisoOpcionalGuardaCorrectamente() {
        when(vinculoRepository.findByIdIdCiudadanoAndEsPrincipalTrueAndVigenteHastaIsNull(PERSONA))
                .thenReturn(Optional.empty());

        var reqConPiso = new CrearDomicilioRequest("DEPARTAMENTO", "Av Corrientes", "1234", "4B", null, null, null, true);
        var res = domicilioService.crear(PERSONA, reqConPiso);
        assertThat(res).isNotNull();

        var reqSinPiso = new CrearDomicilioRequest("CASA", "Av Rivadavia", "1000", null, null, null, null, false);
        var resSin = domicilioService.crear(PERSONA, reqSinPiso);
        assertThat(resSin).isNotNull();
    }

    private CiudadanoPropiedad vinculo(Long propiedadId, boolean principal, LocalDate hasta) {
        CiudadanoPropiedad v = new CiudadanoPropiedad();
        v.setId(new CiudadanoPropiedadId(PERSONA, propiedadId));
        v.setVigenteDesde(LocalDate.now().minusDays(1));
        v.setVigenteHasta(hasta);
        v.setEsPrincipal(principal);
        return v;
    }
}

package ar.edu.uade.ciudadanos.organizacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.domicilio.DomicilioService;
import ar.edu.uade.ciudadanos.organizacion.dto.CrearOrganizacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.OrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.OtroDuenoRequest;
import ar.edu.uade.ciudadanos.organizacion.entity.CiudadanoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import ar.edu.uade.ciudadanos.organizacion.repository.CiudadanoOrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.OrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.persona.dto.DatosPersona;
import ar.edu.uade.ciudadanos.security.AuthPrincipal;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.TipoSujeto;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrganizacionServiceTest {

    @Mock
    private OrganizacionRepository organizacionRepository;

    @Mock
    private CiudadanoOrganizacionRepository duenoRepository;

    @Mock
    private RepresentacionRepository representacionRepository;

    @Mock
    private CiudadanoDirectorioService directorio;

    @Mock
    private DomicilioService domicilioService;

    @Mock
    private AutorizacionService autorizacion;

    private OrganizacionService organizacionService;

    @BeforeEach
    void setUp() {
        organizacionService = new OrganizacionService(
                organizacionRepository,
                duenoRepository,
                representacionRepository,
                directorio,
                domicilioService,
                autorizacion
        );
    }

    @Test
    void crearOrganizacion_conPorcentajeCreadorYOtrosDuenos_guardaCorrectamente() {
        AuthPrincipal principal = new AuthPrincipal(1L, TipoSujeto.CIUDADANO, "PERSONA");
        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "20111222119",
                "Mi Empresa SAS",
                "Mi Fantasia",
                "SAS",
                null,
                BigDecimal.valueOf(60),
                List.of(new OtroDuenoRequest(2L, 2L, BigDecimal.valueOf(40))),
                null
        );

        when(organizacionRepository.existsByCuit(20111222119L)).thenReturn(false);
        when(organizacionRepository.existsByTaxId("20111222119")).thenReturn(false);
        when(directorio.existe(1L)).thenReturn(true);
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> {
            Organizacion o = inv.getArgument(0);
            o.setOrganizacionId(10L);
            return o;
        });
        when(representacionRepository.findByOrganizacionIdAndEstado(any(), any())).thenReturn(Collections.emptyList());
        when(duenoRepository.findByIdIdOrganizacion(10L)).thenReturn(Collections.emptyList());

        OrganizacionResponse response = organizacionService.crear(principal, request);

        assertThat(response).isNotNull();
        assertThat(response.razonSocial()).isEqualTo("Mi Empresa SAS");
        assertThat(response.tipo()).isEqualTo("SAS");

        ArgumentCaptor<CiudadanoOrganizacion> captor = ArgumentCaptor.forClass(CiudadanoOrganizacion.class);
        verify(duenoRepository, org.mockito.Mockito.times(2)).save(captor.capture());

        List<CiudadanoOrganizacion> guardados = captor.getAllValues();
        assertThat(guardados).hasSize(2);
        assertThat(guardados.get(0).getId().getIdCiudadano()).isEqualTo(1L);
        assertThat(guardados.get(0).getPorcentajeTitularidad()).isEqualTo(BigDecimal.valueOf(60));
        assertThat(guardados.get(1).getId().getIdCiudadano()).isEqualTo(2L);
        assertThat(guardados.get(1).getPorcentajeTitularidad()).isEqualTo(BigDecimal.valueOf(40));
    }

    @Test
    void crearOrganizacion_porcentajesSuperan100_lanzaConflicto() {
        AuthPrincipal principal = new AuthPrincipal(1L, TipoSujeto.CIUDADANO, "PERSONA");
        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "20111222119",
                "Mi Empresa SAS",
                null,
                "SAS",
                null,
                BigDecimal.valueOf(70),
                List.of(new OtroDuenoRequest(2L, 2L, BigDecimal.valueOf(40))),
                null
        );

        when(organizacionRepository.existsByCuit(20111222119L)).thenReturn(false);
        when(organizacionRepository.existsByTaxId("20111222119")).thenReturn(false);

        assertThatThrownBy(() -> organizacionService.crear(principal, request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("supera el 100%");
    }
}

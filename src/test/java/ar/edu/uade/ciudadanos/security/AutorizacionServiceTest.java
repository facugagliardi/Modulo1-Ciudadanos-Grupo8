package ar.edu.uade.ciudadanos.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.organizacion.entity.Representacion;
import ar.edu.uade.ciudadanos.organizacion.repository.PersonaOrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

/** Las dos reglas: sobre lo propio no hace falta permiso, sobre lo ajeno si. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AutorizacionServiceTest {

    private static final Long YO = 1L;
    private static final Long OTRO = 2L;
    private static final Long ORG = 50L;

    @Mock private PersonaOrganizacionRepository personaOrganizacionRepository;
    @Mock private RepresentacionRepository representacionRepository;

    @InjectMocks private AutorizacionService autorizacion;

    private void autenticadoComo(Long id, TipoSujeto tipo, Rol rol) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new AuthPrincipal(id, tipo, rol.name()), null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + rol))));
    }

    @AfterEach
    void limpiar() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void sinAutenticarDa401() {
        assertThatThrownBy(() -> autorizacion.actual())
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    // ------------------------------------------------------------------ personas

    @Test
    void unaPersonaOperaSobreSusPropiosDatosSinNingunPermiso() {
        autenticadoComo(YO, TipoSujeto.CIUDADANO, Rol.PERSONA);

        assertThatCode(() -> autorizacion.exigirLecturaDePersona(YO)).doesNotThrowAnyException();
        assertThatCode(() -> autorizacion.exigirEscrituraSobrePersona(YO)).doesNotThrowAnyException();
    }

    @Test
    void unaPersonaNoLlegaALosDatosDeOtra() {
        autenticadoComo(YO, TipoSujeto.CIUDADANO, Rol.PERSONA);

        assertThatThrownBy(() -> autorizacion.exigirLecturaDePersona(OTRO))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    /** Una juridica tiene exactamente los mismos permisos que un ciudadano. */
    @Test
    void unaPersonaJuridicaSeComportaIgualQueUnCiudadano() {
        autenticadoComo(YO, TipoSujeto.JURIDICA, Rol.PERSONA);

        assertThatCode(() -> autorizacion.exigirEscrituraSobrePersona(YO)).doesNotThrowAnyException();
        assertThatThrownBy(() -> autorizacion.exigirEscrituraSobrePersona(OTRO))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void elAuditorLeeDatosAjenosPeroNoLosModifica() {
        autenticadoComo(9L, TipoSujeto.EMPLEADO, Rol.AUDITOR);

        assertThatCode(() -> autorizacion.exigirLecturaDePersona(OTRO)).doesNotThrowAnyException();
        assertThatThrownBy(() -> autorizacion.exigirEscrituraSobrePersona(OTRO))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void mesaDeEntradasSiModificaDatosAjenos() {
        autenticadoComo(9L, TipoSujeto.EMPLEADO, Rol.MESA_ENTRADAS);

        assertThatCode(() -> autorizacion.exigirEscrituraSobrePersona(OTRO)).doesNotThrowAnyException();
    }

    @Test
    void elMensajeDe403DiceQueRolTenesYQuePermisoHaceFalta() {
        autenticadoComo(9L, TipoSujeto.EMPLEADO, Rol.MESA_ENTRADAS);

        assertThatThrownBy(() -> autorizacion.exigir(Permiso.VALIDAR_DOCUMENTACION, "validar documentacion"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("MESA_ENTRADAS")
                .hasMessageContaining("validar documentacion")
                .hasMessageContaining("VALIDAR_DOCUMENTACION");
    }

    // ------------------------------------------------------------ organizaciones

    @Test
    void unDuenoOperaSobreSuOrganizacion() {
        autenticadoComo(YO, TipoSujeto.CIUDADANO, Rol.PERSONA);
        when(personaOrganizacionRepository.existsById(any())).thenReturn(true);

        assertThatCode(() -> autorizacion.exigirEscrituraSobreOrganizacion(ORG)).doesNotThrowAnyException();
    }

    @Test
    void unRepresentanteVigenteTambien() {
        autenticadoComo(YO, TipoSujeto.CIUDADANO, Rol.PERSONA);
        when(personaOrganizacionRepository.existsById(any())).thenReturn(false);
        when(representacionRepository.findVigente(anyLong(), anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.of(new Representacion()));

        assertThatCode(() -> autorizacion.exigirEscrituraSobreOrganizacion(ORG)).doesNotThrowAnyException();
    }

    @Test
    void unExtranoNoOperaSobreLaOrganizacion() {
        autenticadoComo(YO, TipoSujeto.CIUDADANO, Rol.PERSONA);
        when(personaOrganizacionRepository.existsById(any())).thenReturn(false);
        when(representacionRepository.findVigente(anyLong(), anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> autorizacion.exigirEscrituraSobreOrganizacion(ORG))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("dueno o un representante vigente");
    }

    /** Otorgar poderes es mas restringido que editar datos: el auditor no puede. */
    @Test
    void elAuditorNoAdministraRepresentaciones() {
        autenticadoComo(9L, TipoSujeto.EMPLEADO, Rol.AUDITOR);
        when(personaOrganizacionRepository.existsById(any())).thenReturn(false);
        when(representacionRepository.findVigente(anyLong(), anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> autorizacion.exigirGestionDeRepresentaciones(ORG))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void elAdministrativoSiAdministraRepresentaciones() {
        autenticadoComo(9L, TipoSujeto.EMPLEADO, Rol.ADMINISTRATIVO);
        when(personaOrganizacionRepository.existsById(any())).thenReturn(false);
        when(representacionRepository.findVigente(anyLong(), anyLong(), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        assertThatCode(() -> autorizacion.exigirGestionDeRepresentaciones(ORG)).doesNotThrowAnyException();
    }

    // ---------------------------------------------------------------- auditoria

    @Test
    void elActorDeAuditoriaIncluyeTipoIdYRol() {
        autenticadoComo(9L, TipoSujeto.EMPLEADO, Rol.RESPONSABLE_AREA);

        assertThat(autorizacion.actorActual()).isEqualTo("EMPLEADO:9:RESPONSABLE_AREA");
    }

    @Test
    void unTokenConRolDesconocidoNoAutorizaNada() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new AuthPrincipal(9L, TipoSujeto.EMPLEADO, "SUPERUSUARIO"), null, List.of()));

        assertThat(autorizacion.puede(Permiso.LEER_TERCEROS)).isFalse();
        assertThat(autorizacion.rolActual()).isEmpty();
    }
}

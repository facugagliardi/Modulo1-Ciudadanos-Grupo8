package ar.edu.uade.ciudadanos.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import ar.edu.uade.ciudadanos.organizacion.repository.PersonaOrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * @SoloInterno es una meta-anotacion de @PreAuthorize, puesta a nivel de CLASE,
 * que ademas resuelve el permiso llamando al bean {@code permisos} por SpEL. Si
 * cualquiera de esas tres piezas fallara, los endpoints inter-modulo quedarian
 * abiertos sin que nada explotara: por eso se verifica que denieguen de verdad.
 */
class SoloInternoTest {

    @SoloInterno
    static class ConsultaFalsa {
        String responder() {
            return "ok";
        }
    }

    @Configuration
    @EnableMethodSecurity
    static class Config {
        /** El bean tiene que llamarse "permisos": asi lo referencia la anotacion. */
        @Bean("permisos")
        AutorizacionService permisos() {
            return new AutorizacionService(
                    mock(PersonaOrganizacionRepository.class), mock(RepresentacionRepository.class));
        }

        @Bean
        ConsultaFalsa consultaFalsa() {
            return new ConsultaFalsa();
        }
    }

    @AfterEach
    void limpiar() {
        SecurityContextHolder.clearContext();
    }

    private ConsultaFalsa conRol(Rol rol) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new AuthPrincipal(1L, TipoSujeto.EMPLEADO, rol.name()), null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + rol))));
        return new AnnotationConfigApplicationContext(Config.class).getBean(ConsultaFalsa.class);
    }

    @Test
    void unaPersonaNoPuedeEntrarALasConsultasInterModulo() {
        assertThatThrownBy(conRol(Rol.PERSONA)::responder).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void unServicioSi() {
        assertThat(conRol(Rol.SERVICIO).responder()).isEqualTo("ok");
    }

    @Test
    void unEmpleadoDeMesaDeEntradasSi() {
        assertThatCode(() -> conRol(Rol.MESA_ENTRADAS).responder()).doesNotThrowAnyException();
    }

    @Test
    void unAuditorSi() {
        assertThat(conRol(Rol.AUDITOR).responder()).isEqualTo("ok");
    }

    @Test
    void unAdministrativoSi() {
        assertThat(conRol(Rol.ADMINISTRATIVO).responder()).isEqualTo("ok");
    }
}

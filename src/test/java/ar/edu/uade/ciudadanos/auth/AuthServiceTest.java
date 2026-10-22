package ar.edu.uade.ciudadanos.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.auth.dto.LoginRequest;
import ar.edu.uade.ciudadanos.auth.dto.RegisterRequest;
import ar.edu.uade.ciudadanos.auth.dto.RegisterResponse;
import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.empleado.repository.CredencialEmpleadoRepository;
import ar.edu.uade.ciudadanos.empleado.repository.CuentaEmpleadoRepository;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.CredencialCiudadano;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.CredencialCiudadanoRepository;
import ar.edu.uade.ciudadanos.security.JwtProperties;
import ar.edu.uade.ciudadanos.security.JwtService;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

    private static final long CUIL = 20345678901L;

    @Mock private CiudadanoRepository ciudadanoRepository;
    @Mock private CredencialCiudadanoRepository credencialCiudadanoRepository;
    @Mock private CuentaEmpleadoRepository cuentaEmpleadoRepository;
    @Mock private CredencialEmpleadoRepository credencialEmpleadoRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private AuthService authService;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret("c2VjcmV0by1kZS1wcnVlYmEtcXVlLXN1cGVyYS1sb3MtMzItYnl0ZXMtcmVxdWVyaWRvcw==");

        authService = new AuthService(ciudadanoRepository, credencialCiudadanoRepository,
                cuentaEmpleadoRepository, credencialEmpleadoRepository,
                passwordEncoder, new JwtService(props));
    }

    // ---------------------------------------------------------------- registro

    @Test
    void registrarCiudadanoDevuelveDatosCorrectos() {
        when(ciudadanoRepository.existsByCuit(CUIL)).thenReturn(false);
        when(ciudadanoRepository.existsByDocumentoId("34567890")).thenReturn(false);
        when(ciudadanoRepository.save(any(Ciudadano.class))).thenAnswer(inv -> {
            Ciudadano c = inv.getArgument(0);
            c.setId(1L);
            return c;
        });

        RegisterResponse respuesta = authService.registrar(new RegisterRequest(
                "20-34567890-1", "clave-segura-1", "34567890",
                "Diego", "Lopez", LocalDate.of(1989, 4, 12)));

        assertThat(respuesta.ciudadanoId()).isEqualTo(1L);
        assertThat(respuesta.cuil()).isEqualTo("20345678901");
        assertThat(respuesta.estado()).isEqualTo("ACTIVO");
    }

    @Test
    void laClaveSeGuardaHasheada() {
        when(ciudadanoRepository.existsByCuit(CUIL)).thenReturn(false);
        when(ciudadanoRepository.existsByDocumentoId("34567890")).thenReturn(false);
        when(ciudadanoRepository.save(any(Ciudadano.class))).thenAnswer(inv -> {
            Ciudadano c = inv.getArgument(0);
            c.setId(1L);
            return c;
        });

        authService.registrar(new RegisterRequest("20345678901", "clave-segura-1",
                "34567890", "Diego", "Lopez", LocalDate.of(1989, 4, 12)));

        var capturada = org.mockito.ArgumentCaptor.forClass(CredencialCiudadano.class);
        verify(credencialCiudadanoRepository).save(capturada.capture());
        assertThat(capturada.getValue().getPassword())
                .isNotEqualTo("clave-segura-1")
                .satisfies(hash -> assertThat(passwordEncoder.matches("clave-segura-1", hash)).isTrue());
    }

    @Test
    void unCuitRepetidoDa409YNoCreaNada() {
        when(ciudadanoRepository.existsByCuit(CUIL)).thenReturn(true);

        assertThatThrownBy(() -> authService.registrar(new RegisterRequest(
                "20345678901", "clave-segura-1", "34567890", "Diego", "Lopez", LocalDate.of(1989, 4, 12))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus())
                .isEqualTo(HttpStatus.CONFLICT);

        verify(ciudadanoRepository, never()).save(any());
    }

    @Test
    void unCuitQueNoTiene11DigitosDa400() {
        assertThatThrownBy(() -> authService.registrar(new RegisterRequest(
                "123", "clave-segura-1", "34567890", "Diego", "Lopez", LocalDate.of(1989, 4, 12))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void registrarCiudadanoSinFechaDeNacimientoDa400() {
        assertThatThrownBy(() -> authService.registrar(new RegisterRequest(
                "20345678901", "clave-segura-1", "34567890", "Diego", "Lopez", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("fechaNacimiento");
    }

    // ------------------------------------------------------------------- login

    @Test
    void loginCorrectoDevuelveTokensYRol() {
        prepararCiudadanoConClave("clave-segura-1", EstadoCiudadano.ACTIVO);

        var sesion = authService.login(new LoginRequest("20-34567890-1", "clave-segura-1"));

        assertThat(sesion.cuerpo().personaId()).isEqualTo(1L);
        assertThat(sesion.cuerpo().rol()).isEqualTo("PERSONA");
        assertThat(sesion.cuerpo().tipoPersona()).isEqualTo("CIUDADANO");
        assertThat(sesion.tokens().accessToken()).isNotBlank();
        assertThat(sesion.tokens().refreshToken()).isNotBlank();
        assertThat(sesion.tokens().expiresInSeconds()).isPositive();
    }

    @Test
    void claveIncorrectaDa401() {
        prepararCiudadanoConClave("clave-segura-1", EstadoCiudadano.ACTIVO);

        assertThatThrownBy(() -> authService.login(new LoginRequest("20345678901", "otra-clave")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void cuitInexistenteDa404() {
        when(ciudadanoRepository.findByCuit(CUIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("20345678901", "clave-segura-1")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void unaCuentaBloqueadaDa403AunConLaClaveCorrecta() {
        prepararCiudadanoConClave("clave-segura-1", EstadoCiudadano.BLOQUEADO);

        assertThatThrownBy(() -> authService.login(new LoginRequest("20345678901", "clave-segura-1")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ----------------------------------------------------------------- refresh

    @Test
    void elRefreshDevuelveUnAccessTokenNuevo() {
        prepararCiudadanoConClave("clave-segura-1", EstadoCiudadano.ACTIVO);
        var sesion = authService.login(new LoginRequest("20345678901", "clave-segura-1"));

        var renovado = authService.refrescar(sesion.tokens().refreshToken());

        assertThat(renovado.accessToken()).isNotBlank();
    }

    @Test
    void unAccessTokenNoSirveParaRefrescar() {
        prepararCiudadanoConClave("clave-segura-1", EstadoCiudadano.ACTIVO);
        var sesion = authService.login(new LoginRequest("20345678901", "clave-segura-1"));

        assertThatThrownBy(() -> authService.refrescar(sesion.tokens().accessToken()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private void prepararCiudadanoConClave(String claveEnClaro, EstadoCiudadano estado) {
        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setId(1L);
        ciudadano.setCuit(CUIL);
        ciudadano.setEstado(estado);

        CredencialCiudadano credencial = new CredencialCiudadano();
        credencial.setCiudadano(ciudadano);
        credencial.setPassword(passwordEncoder.encode(claveEnClaro));

        when(ciudadanoRepository.findByCuit(CUIL)).thenReturn(Optional.of(ciudadano));
        when(credencialCiudadanoRepository.findByCiudadano_Cuit(CUIL)).thenReturn(Optional.of(credencial));
    }
}

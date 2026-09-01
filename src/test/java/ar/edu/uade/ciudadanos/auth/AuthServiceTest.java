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
import ar.edu.uade.ciudadanos.persona.entity.CredencialPersona;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import ar.edu.uade.ciudadanos.persona.entity.Persona;
import ar.edu.uade.ciudadanos.persona.entity.TipoPersona;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.CredencialPersonaRepository;
import ar.edu.uade.ciudadanos.persona.repository.PersonaJuridicaRepository;
import ar.edu.uade.ciudadanos.persona.repository.PersonaRepository;
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

    @Mock private PersonaRepository personaRepository;
    @Mock private CiudadanoRepository ciudadanoRepository;
    @Mock private PersonaJuridicaRepository personaJuridicaRepository;
    @Mock private CredencialPersonaRepository credencialPersonaRepository;
    @Mock private CuentaEmpleadoRepository cuentaEmpleadoRepository;
    @Mock private CredencialEmpleadoRepository credencialEmpleadoRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private AuthService authService;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret("c2VjcmV0by1kZS1wcnVlYmEtcXVlLXN1cGVyYS1sb3MtMzItYnl0ZXMtcmVxdWVyaWRvcw==");

        authService = new AuthService(personaRepository, ciudadanoRepository, personaJuridicaRepository,
                credencialPersonaRepository, cuentaEmpleadoRepository, credencialEmpleadoRepository,
                passwordEncoder, new JwtService(props));
    }

    // ---------------------------------------------------------------- registro

    @Test
    void registrarCiudadanoDevuelveCuilYNoCuit() {
        when(personaRepository.existsByCuit(CUIL)).thenReturn(false);
        when(personaRepository.save(any(Persona.class))).thenAnswer(inv -> {
            Persona p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });

        RegisterResponse respuesta = authService.registrar(new RegisterRequest(
                TipoPersona.CIUDADANO, "20-34567890-1", "clave-segura-1", "34567890",
                "Diego", "Lopez", LocalDate.of(1989, 4, 12), null, null, null));

        assertThat(respuesta.personaId()).isEqualTo(1L);
        assertThat(respuesta.tipo()).isEqualTo("CIUDADANO");
        assertThat(respuesta.cuil()).isEqualTo("20345678901");
        assertThat(respuesta.cuit()).isNull();
        assertThat(respuesta.estado()).isEqualTo("ACTIVO");
    }

    @Test
    void laClaveSeGuardaHasheada() {
        when(personaRepository.save(any(Persona.class))).thenAnswer(inv -> {
            Persona p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });

        authService.registrar(new RegisterRequest(TipoPersona.CIUDADANO, "20345678901", "clave-segura-1",
                "34567890", "Diego", "Lopez", LocalDate.of(1989, 4, 12), null, null, null));

        var capturada = org.mockito.ArgumentCaptor.forClass(CredencialPersona.class);
        verify(credencialPersonaRepository).save(capturada.capture());
        assertThat(capturada.getValue().getPassword())
                .isNotEqualTo("clave-segura-1")
                .satisfies(hash -> assertThat(passwordEncoder.matches("clave-segura-1", hash)).isTrue());
    }

    @Test
    void unCuitRepetidoDa409YNoCreaNada() {
        when(personaRepository.existsByCuit(CUIL)).thenReturn(true);

        assertThatThrownBy(() -> authService.registrar(new RegisterRequest(TipoPersona.CIUDADANO,
                "20345678901", "clave-segura-1", "34567890", "Diego", "Lopez", null, null, null, null)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus())
                .isEqualTo(HttpStatus.CONFLICT);

        verify(personaRepository, never()).save(any());
    }

    @Test
    void unCuitQueNoTiene11DigitosDa400() {
        assertThatThrownBy(() -> authService.registrar(new RegisterRequest(TipoPersona.CIUDADANO,
                "123", "clave-segura-1", "34567890", "Diego", "Lopez", null, null, null, null)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void registrarJuridicaSinRazonSocialDa400() {
        when(personaRepository.save(any(Persona.class))).thenAnswer(inv -> {
            Persona p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });

        assertThatThrownBy(() -> authService.registrar(new RegisterRequest(TipoPersona.JURIDICA,
                "30345678901", "clave-segura-1", null, null, null, null, null, "Fantasia SRL", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("razonSocial");
    }

    @Test
    void registrarCiudadanoSinFechaDeNacimientoDa400() {
        when(personaRepository.save(any(Persona.class))).thenAnswer(inv -> {
            Persona p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });

        assertThatThrownBy(() -> authService.registrar(new RegisterRequest(TipoPersona.CIUDADANO,
                "20345678901", "clave-segura-1", "34567890", "Diego", "Lopez", null, null, null, null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("fechaNacimiento");
    }

    @Test
    void registrarJuridicaDevuelveCuitYNombreFantasia() {
        when(personaRepository.save(any(Persona.class))).thenAnswer(inv -> {
            Persona p = inv.getArgument(0);
            p.setId(2L);
            return p;
        });

        RegisterResponse respuesta = authService.registrar(new RegisterRequest(
                TipoPersona.JURIDICA, "30-71234567-8", "clave-segura-1", null, null, null, null,
                "Constructora del Sur S.A.", "ConSur", null));

        assertThat(respuesta.tipo()).isEqualTo("JURIDICA");
        assertThat(respuesta.cuit()).isEqualTo("30712345678");
        assertThat(respuesta.cuil()).isNull();
        assertThat(respuesta.razonSocial()).isEqualTo("Constructora del Sur S.A.");
        // nombreFantasia se persiste en la columna "nombre" del diagrama.
        assertThat(respuesta.nombreFantasia()).isEqualTo("ConSur");

        var capturada = org.mockito.ArgumentCaptor.forClass(
                ar.edu.uade.ciudadanos.persona.entity.PersonaJuridica.class);
        verify(personaJuridicaRepository).save(capturada.capture());
        assertThat(capturada.getValue().getNombre()).isEqualTo("ConSur");
    }

    // ------------------------------------------------------------------- login

    @Test
    void loginCorrectoDevuelveTokensYRol() {
        prepararCiudadanoConClave("clave-segura-1", EstadoCiudadano.ACTIVO);

        var sesion = authService.login(new LoginRequest("20-34567890-1", "clave-segura-1"));

        assertThat(sesion.cuerpo().personaId()).isEqualTo(1L);
        // Ciudadanos y juridicas comparten rol; el tipo va aparte.
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
        when(personaRepository.findByCuit(CUIL)).thenReturn(Optional.empty());

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
        Persona persona = new Persona();
        persona.setId(1L);
        persona.setTipo(TipoPersona.CIUDADANO);
        persona.setCuit(CUIL);

        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setId(1L);
        ciudadano.setEstado(estado);

        CredencialPersona credencial = new CredencialPersona();
        credencial.setPersonaId(1L);
        credencial.setPassword(passwordEncoder.encode(claveEnClaro));

        when(personaRepository.findByCuit(CUIL)).thenReturn(Optional.of(persona));
        when(credencialPersonaRepository.findByPersonaId(1L)).thenReturn(Optional.of(credencial));
        when(ciudadanoRepository.findById(1L)).thenReturn(Optional.of(ciudadano));
    }
}

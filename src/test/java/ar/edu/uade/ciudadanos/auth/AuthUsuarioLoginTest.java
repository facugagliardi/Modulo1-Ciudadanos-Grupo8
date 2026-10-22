package ar.edu.uade.ciudadanos.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.auth.dto.Sesion;
import ar.edu.uade.ciudadanos.auth.dto.UsuarioLoginRequest;
import ar.edu.uade.ciudadanos.auth.dto.UsuarioLoginResponse;
import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.contacto.repository.ContactoCiudadanoRepository;
import ar.edu.uade.ciudadanos.empleado.entity.CredencialEmpleado;
import ar.edu.uade.ciudadanos.empleado.entity.CuentaEmpleado;
import ar.edu.uade.ciudadanos.empleado.entity.RolEmpleado;
import ar.edu.uade.ciudadanos.empleado.repository.CredencialEmpleadoRepository;
import ar.edu.uade.ciudadanos.empleado.repository.CuentaEmpleadoRepository;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.CredencialCiudadano;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.CredencialCiudadanoRepository;
import ar.edu.uade.ciudadanos.security.JwtProperties;
import ar.edu.uade.ciudadanos.security.JwtService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthUsuarioLoginTest {

    @Mock private CiudadanoRepository ciudadanoRepository;
    @Mock private CredencialCiudadanoRepository credencialCiudadanoRepository;
    @Mock private CuentaEmpleadoRepository cuentaEmpleadoRepository;
    @Mock private CredencialEmpleadoRepository credencialEmpleadoRepository;
    @Mock private ContactoCiudadanoRepository contactoRepository;
    @Mock private EventPublisherService eventPublisherService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private AuthService authService;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret("c2VjcmV0by1kZS1wcnVlYmEtcXVlLXN1cGVyYS1sb3MtMzItYnl0ZXMtcmVxdWVyaWRvcw==");

        authService = new AuthService(
                ciudadanoRepository,
                credencialCiudadanoRepository,
                cuentaEmpleadoRepository,
                credencialEmpleadoRepository,
                passwordEncoder,
                new JwtService(props),
                contactoRepository,
                eventPublisherService
        );
    }

    @Test
    @DisplayName("Login de usuario como empleado municipal exitoso devuelve {user_id, dni, role, auth}")
    void loginEmpleadoExitoso() {
        CuentaEmpleado empleado = new CuentaEmpleado();
        empleado.setEmpleadoId(15L);
        empleado.setNombreEmpleado("Carlos");
        empleado.setApellidoEmpleado("Gomez");
        empleado.setMail("empleado1@gmail.com");
        empleado.setRol(RolEmpleado.ADMINISTRATIVO);
        empleado.setActivo(true);

        CredencialEmpleado credencial = new CredencialEmpleado();
        credencial.setEmpleadoId(15L);
        credencial.setPassword(passwordEncoder.encode("Secret123!"));

        when(cuentaEmpleadoRepository.findByMailIgnoreCase("empleado1@gmail.com"))
                .thenReturn(Optional.of(empleado));
        when(credencialEmpleadoRepository.findByEmpleadoId(15L))
                .thenReturn(Optional.of(credencial));

        Sesion<UsuarioLoginResponse> sesion = authService.loginUsuario(
                new UsuarioLoginRequest("empleado1@gmail.com", "Secret123!")
        );

        assertThat(sesion).isNotNull();
        assertThat(sesion.tokens().accessToken()).isNotBlank();
        assertThat(sesion.tokens().refreshToken()).isNotBlank();
        assertThat(sesion.tokens().expiresInSeconds()).isPositive();

        UsuarioLoginResponse cuerpo = sesion.cuerpo();
        assertThat(cuerpo).isNotNull();
        assertThat(cuerpo.user_id()).isEqualTo(15L);
        assertThat(cuerpo.nombre()).isEqualTo("Carlos");
        assertThat(cuerpo.apellido()).isEqualTo("Gomez");
        assertThat(cuerpo.role()).isEqualTo("ADMINISTRATIVO");
        assertThat(cuerpo.auth()).isTrue();
        assertThat(cuerpo.contactos()).hasSize(1);
        assertThat(cuerpo.contactos().get(0).valor()).isEqualTo("empleado1@gmail.com");
    }

    @Test
    @DisplayName("Login de usuario como ciudadano exitoso devuelve {user_id, dni, nombre, apellido, cuit, role=CIUDADANO, auth, tokens, contactos}")
    void loginCiudadanoExitoso() {
        when(cuentaEmpleadoRepository.findByMailIgnoreCase("ciudadano1@gmail.com"))
                .thenReturn(Optional.empty());

        when(contactoRepository.findCiudadanoIdsByValor("ciudadano1@gmail.com"))
                .thenReturn(List.of(8452L));
        when(contactoRepository.findByCiudadanoId(8452L))
                .thenReturn(List.of());

        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setId(8452L);
        ciudadano.setNombre("Marcos");
        ciudadano.setApellido("Ferreyra");
        ciudadano.setCuit(20345678901L);
        ciudadano.setDocumentoId("34567890");
        ciudadano.setEstado(EstadoCiudadano.ACTIVO);

        CredencialCiudadano credencial = new CredencialCiudadano();
        credencial.setCiudadano(ciudadano);
        credencial.setPassword(passwordEncoder.encode("Pass123!"));

        when(ciudadanoRepository.findById(8452L)).thenReturn(Optional.of(ciudadano));
        when(credencialCiudadanoRepository.findByCiudadano_Cuit(20345678901L)).thenReturn(Optional.of(credencial));

        Sesion<UsuarioLoginResponse> sesion = authService.loginUsuario(
                new UsuarioLoginRequest("ciudadano1@gmail.com", "Pass123!")
        );

        assertThat(sesion).isNotNull();
        assertThat(sesion.tokens().accessToken()).isNotBlank();
        assertThat(sesion.tokens().refreshToken()).isNotBlank();
        assertThat(sesion.tokens().expiresInSeconds()).isEqualTo(900L);

        UsuarioLoginResponse cuerpo = sesion.cuerpo();
        assertThat(cuerpo).isNotNull();
        assertThat(cuerpo.user_id()).isEqualTo(8452L);
        assertThat(cuerpo.dni()).isEqualTo(34567890);
        assertThat(cuerpo.nombre()).isEqualTo("Marcos");
        assertThat(cuerpo.apellido()).isEqualTo("Ferreyra");
        assertThat(cuerpo.cuit()).isEqualTo(20345678901L);
        assertThat(cuerpo.role()).isEqualTo("CIUDADANO");
        assertThat(cuerpo.auth()).isTrue();
        assertThat(cuerpo.contactos()).isNotNull();
    }

    @Test
    @DisplayName("Credenciales invalidas lanza ApiException 401")
    void loginInvalidoLanza401() {
        when(cuentaEmpleadoRepository.findByMailIgnoreCase("inexistente@gmail.com"))
                .thenReturn(Optional.empty());
        when(contactoRepository.findCiudadanoIdsByValor("inexistente@gmail.com"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> authService.loginUsuario(
                new UsuarioLoginRequest("inexistente@gmail.com", "Cualquiera123")
        )).isInstanceOf(ApiException.class)
                .hasMessageContaining("Credenciales invalidas");
    }
}

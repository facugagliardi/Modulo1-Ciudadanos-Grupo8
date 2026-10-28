package ar.edu.uade.ciudadanos.auth;

import ar.edu.uade.ciudadanos.auth.dto.*;
import ar.edu.uade.ciudadanos.contacto.repository.ContactoCiudadanoRepository;
import ar.edu.uade.ciudadanos.empleado.entity.*;
import ar.edu.uade.ciudadanos.empleado.repository.*;
import ar.edu.uade.ciudadanos.persona.entity.*;
import ar.edu.uade.ciudadanos.persona.repository.*;
import ar.edu.uade.ciudadanos.security.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class IdentidadIntegracionTest {
    private final CiudadanoRepository ciudadanos = mock(CiudadanoRepository.class);
    private final CredencialCiudadanoRepository claves = mock(CredencialCiudadanoRepository.class);
    private final CuentaEmpleadoRepository empleados = mock(CuentaEmpleadoRepository.class);
    private final CredencialEmpleadoRepository clavesEmpleado = mock(CredencialEmpleadoRepository.class);
    private final ContactoCiudadanoRepository contactos = mock(ContactoCiudadanoRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private JwtService jwt;
    private AuthService auth;
    private Ciudadano ciudadano;
    private CuentaEmpleado empleado;

    @BeforeEach
    void preparar() {
        JwtProperties props = new JwtProperties();
        props.setSecret("c2VjcmV0by1kZS1wcnVlYmEtcXVlLXN1cGVyYS1sb3MtMzItYnl0ZXMtcmVxdWVyaWRvcw==");
        jwt = new JwtService(props);
        auth = new AuthService(ciudadanos, claves, empleados, clavesEmpleado, encoder, jwt, contactos, null);
        when(encoder.matches("clave", "hash")).thenReturn(true);
        ciudadano = new Ciudadano(); ciudadano.setId(42L); ciudadano.setCuit(20345678901L);
        ciudadano.setDocumentoId("34567890");
        CredencialCiudadano clave = new CredencialCiudadano(); clave.setPassword("hash");
        when(ciudadanos.findByCuit(ciudadano.getCuit())).thenReturn(Optional.of(ciudadano));
        when(ciudadanos.findById(42L)).thenReturn(Optional.of(ciudadano));
        when(claves.findByCiudadano_Cuit(ciudadano.getCuit())).thenReturn(Optional.of(clave));
        empleado = new CuentaEmpleado(); empleado.setEmpleadoId(42L); empleado.setRol(RolEmpleado.ADMINISTRATIVO);
        empleado.setMail("agente@test.ar");
        CredencialEmpleado claveEmp = new CredencialEmpleado(); claveEmp.setPassword("hash");
        when(empleados.findById(42L)).thenReturn(Optional.of(empleado));
        when(empleados.findByMailIgnoreCase("agente@test.ar")).thenReturn(Optional.of(empleado));
        when(clavesEmpleado.findByEmpleadoId(42L)).thenReturn(Optional.of(claveEmp));
        when(contactos.findCiudadanoIdsByValor("vecino@test.ar")).thenReturn(List.of(42L));
        when(contactos.findByCiudadanoId(42L)).thenReturn(List.of());
    }

    @Test
    void ambosLoginsCiudadanosEntreganElMismoUuidEnJsonYTokens() {
        var cuil = auth.login(new LoginRequest("20345678901", "clave"));
        var mail = auth.loginUsuario(new UsuarioLoginRequest("vecino@test.ar", "clave"));
        for (JsonNode cuerpo : List.<JsonNode>of(mapper.valueToTree(cuil.cuerpo()), mapper.valueToTree(mail.cuerpo()))) {
            assertThat(cuerpo.path("uuid").asText()).isEqualTo(ciudadano.getUuid().toString());
            assertThat(cuerpo.path("citizenId").asText()).isEqualTo(ciudadano.getUuid().toString());
            assertThat(cuerpo.path("actorId").asText()).isEqualTo(ciudadano.getUuid().toString());
        }
        for (var token : List.of(cuil.tokens().accessToken(), mail.tokens().accessToken(), cuil.tokens().refreshToken())) {
            var claims = jwt.parsear(token);
            assertThat(claims.getSubject()).isEqualTo("42");
            assertThat(claims.get("citizenId", String.class)).isEqualTo(ciudadano.getUuid().toString());
            assertThat(claims.get("rol", String.class)).isEqualTo("PERSONA");
        }
    }

    @Test
    void empleadoTieneActorPersistidoSinInventarCiudadanoAunqueCoincidaIdNumerico() {
        var directo = auth.loginEmpleado(new EmpleadoLoginRequest("agente@test.ar", "clave"));
        var unificado = auth.loginUsuario(new UsuarioLoginRequest("agente@test.ar", "clave"));
        for (JsonNode cuerpo : List.<JsonNode>of(mapper.valueToTree(directo.cuerpo()), mapper.valueToTree(unificado.cuerpo()))) {
            assertThat(cuerpo.path("actorId").asText()).isEqualTo(empleado.getUuid().toString());
            assertThat(cuerpo.path("actorType").asText()).isEqualTo("EMPLEADO");
            assertThat(cuerpo.hasNonNull("citizenId")).isFalse();
        }
        assertThat(empleado.getUuid()).isNotEqualTo(ciudadano.getUuid());
        var claims = jwt.parsear(auth.refrescar(directo.tokens().refreshToken()).accessToken());
        assertThat(claims.get("actorId", String.class)).isEqualTo(empleado.getUuid().toString());
        assertThat(claims.containsKey("citizenId")).isFalse();
    }

    @Test
    void refreshAntiguoSinUuidSeActualizaDesdeLaBaseYRechazaCuentaBloqueada() {
        String antiguo = jwt.generarRefreshToken(new AuthPrincipal(42L, TipoSujeto.CIUDADANO, "CIUDADANO"));
        var renovado = auth.refrescar(antiguo);
        assertThat(jwt.parsear(renovado.accessToken()).get("citizenId", String.class)).isEqualTo(ciudadano.getUuid().toString());
        ciudadano.setEstado(EstadoCiudadano.BLOQUEADO);
        assertThatThrownBy(() -> auth.refrescar(renovado.refreshToken())).hasMessageContaining("BLOQUEADO");
    }

    @Test
    void refreshEmpleadoInactivoNoEmiteTokens() {
        String refresh = jwt.generarRefreshToken(new AuthPrincipal(42L, TipoSujeto.EMPLEADO, "AUDITOR", empleado.getUuid()));
        empleado.setActivo(false);
        assertThatThrownBy(() -> auth.refrescar(refresh)).hasMessageContaining("inactivo");
    }
}

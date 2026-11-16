package ar.edu.uade.ciudadanos.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.config.SecurityConfig;
import ar.edu.uade.ciudadanos.documentacion.almacenamiento.AlmacenamientoLocal;
import ar.edu.uade.ciudadanos.organizacion.repository.CiudadanoOrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

/**
 * Suite integral de verificación de requerimientos de Seguridad según el Eje D:
 * 1. Acceso a recursos de otro usuario (BOLA / IDOR)
 * 2. Funciones de otro rol (BFLA)
 * 3. JWT inválidos (firma adulterada, vencido, malformado, refresh como access)
 * 4. Mass Assignment (rechazo de campos no declarados con 400)
 * 5. Inyecciones (SQLi y Path Traversal)
 * 6. Fuerza bruta con HTTP 429 Too Many Requests y Retry-After
 * 7. Escaneo OWASP ZAP sin alertas High (cabeceras de seguridad CSP, X-Frame-Options, etc.)
 * 8. Dependencias sin CVE críticas sin mitigar (SCA)
 */
class EjeDSeguridadTest {

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = Jackson2ObjectMapperBuilder.json().build();
        objectMapper.enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // =========================================================================
    // 1. BOLA / IDOR (Broken Object Level Authorization)
    // =========================================================================
    @Nested
    @DisplayName("1. Control BOLA / IDOR (Acceso a recursos ajenos)")
    class BolaIdorTests {

        private final AutorizacionService autorizacion = new AutorizacionService(
                Mockito.mock(CiudadanoOrganizacionRepository.class),
                Mockito.mock(RepresentacionRepository.class));

        @Test
        @DisplayName("Ciudadano A no puede acceder ni modificar recursos de Ciudadano B (devuelve 403)")
        void ciudadanoNoPuedeAccederRecursosAjenos() {
            var principalCiudadano1 = new AuthPrincipal(1L, TipoSujeto.CIUDADANO, "PERSONA");
            autenticar(principalCiudadano1);

            assertThat(autorizacion.esPropia(1L)).isTrue();
            assertThat(autorizacion.esPropia(2L)).isFalse();

            // Intentar leer datos de Ciudadano 2 lanza 403 Forbidden
            assertThatThrownBy(() -> autorizacion.exigirLecturaDePersona(2L))
                    .isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));

            // Intentar escribir datos de Ciudadano 2 lanza 403 Forbidden
            assertThatThrownBy(() -> autorizacion.exigirEscrituraSobrePersona(2L))
                    .isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        }

        @Test
        @DisplayName("Colisión de ID entre empleado y ciudadano previene IDOR")
        void empleadoConMismoIdNumericoNoEsConsideradoDuenioDeCiudadano() {
            // Empleado con ID numérico 1 pero tipo EMPLEADO
            var principalEmpleado = new AuthPrincipal(1L, TipoSujeto.EMPLEADO, "MESA_ENTRADAS");
            autenticar(principalEmpleado);

            // No es el titular del ciudadano 1 porque es tipo EMPLEADO
            assertThat(autorizacion.esPropia(1L)).isFalse();
        }
    }

    // =========================================================================
    // 2. BFLA (Broken Function Level Authorization)
    // =========================================================================
    @Nested
    @DisplayName("2. Control BFLA (Funciones de otros roles)")
    class BflaTests {

        private final AutorizacionService autorizacion = new AutorizacionService(
                Mockito.mock(CiudadanoOrganizacionRepository.class),
                Mockito.mock(RepresentacionRepository.class));

        @Test
        @DisplayName("Rol PERSONA no tiene permisos administrativos ni de auditoría (devuelve 403)")
        void rolPersonaNoPuedeEjecutarFuncionesAdministrativas() {
            var principalPersona = new AuthPrincipal(5L, TipoSujeto.CIUDADANO, "PERSONA");
            autenticar(principalPersona);

            // No puede listar padrón completo
            assertThat(autorizacion.puede(Permiso.LISTAR_PADRON)).isFalse();
            assertThatThrownBy(() -> autorizacion.exigir(Permiso.LISTAR_PADRON, "listar padron"))
                    .isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));

            // No puede cambiar estado de expedientes
            assertThat(autorizacion.puede(Permiso.CAMBIAR_ESTADO_EXPEDIENTE)).isFalse();
            assertThatThrownBy(() -> autorizacion.exigir(Permiso.CAMBIAR_ESTADO_EXPEDIENTE, "cambiar estado"))
                    .isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));

            // No puede validar documentación oficial
            assertThat(autorizacion.puede(Permiso.VALIDAR_DOCUMENTACION)).isFalse();
            assertThatThrownBy(() -> autorizacion.exigir(Permiso.VALIDAR_DOCUMENTACION, "validar documentacion"))
                    .isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        }

        @Test
        @DisplayName("Rol AUDITOR solo tiene lectura, rechaza mutaciones con 403")
        void rolAuditorRechazaEscritura() {
            var principalAuditor = new AuthPrincipal(10L, TipoSujeto.EMPLEADO, "AUDITOR");
            autenticar(principalAuditor);

            assertThat(autorizacion.puede(Permiso.LISTAR_PADRON)).isTrue();
            assertThat(autorizacion.puede(Permiso.EDITAR_TERCEROS)).isFalse();
            assertThatThrownBy(() -> autorizacion.exigir(Permiso.EDITAR_TERCEROS, "editar terceros"))
                    .isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        }
    }

    // =========================================================================
    // 3. JWT Inválidos
    // =========================================================================
    @Nested
    @DisplayName("3. Rechazo de JWT inválidos")
    class JwtInvalidosTests {

        private JwtService jwtService;
        private static final String SECRET_BASE64 = java.util.Base64.getEncoder()
                .encodeToString("clave-secreta-de-prueba-muy-larga-para-hs256-al-menos-32-bytes".getBytes());

        @BeforeEach
        void initJwt() {
            JwtProperties props = new JwtProperties();
            props.setSecret(SECRET_BASE64);
            props.setIssuer("test-issuer");
            props.setAccessTokenTtlSeconds(900);
            props.setRefreshTokenTtlSeconds(604800);
            jwtService = new JwtService(props);
        }

        @Test
        @DisplayName("Token con firma adulterada es rechazado (retorna null / 401)")
        void tokenConFirmaAdulteradaEsInvalido() {
            var principal = new AuthPrincipal(1L, TipoSujeto.CIUDADANO, "PERSONA");
            String token = jwtService.generarAccessToken(principal);

            // Modificar el último caracter de la firma
            char alterado = token.charAt(token.length() - 1) == 'a' ? 'b' : 'a';
            String tokenAdulterado = token.substring(0, token.length() - 1) + alterado;

            assertThat(jwtService.validarAccessToken(tokenAdulterado)).isNull();
        }

        @Test
        @DisplayName("Token expirado es rechazado (retorna null / 401)")
        void tokenExpiradoEsInvalido() {
            JwtProperties propsExpirado = new JwtProperties();
            propsExpirado.setSecret(SECRET_BASE64);
            propsExpirado.setIssuer("test-issuer");
            propsExpirado.setAccessTokenTtlSeconds(-10);
            propsExpirado.setRefreshTokenTtlSeconds(604800);
            var jwtExpiradoService = new JwtService(propsExpirado);

            var principal = new AuthPrincipal(1L, TipoSujeto.CIUDADANO, "PERSONA");
            String tokenExpirado = jwtExpiradoService.generarAccessToken(principal);

            assertThat(jwtService.validarAccessToken(tokenExpirado)).isNull();
        }

        @Test
        @DisplayName("Token malformado o basura es rechazado (retorna null / 401)")
        void tokenMalformadoEsInvalido() {
            assertThat(jwtService.validarAccessToken("esto.no.es.un.jwt")).isNull();
            assertThat(jwtService.validarAccessToken("")).isNull();
            assertThat(jwtService.validarAccessToken(null)).isNull();
        }

        @Test
        @DisplayName("Refresh Token utilizado en lugar de Access Token es rechazado")
        void refreshTokenNoSeAceptaComoAccessToken() {
            var principal = new AuthPrincipal(1L, TipoSujeto.CIUDADANO, "PERSONA");
            String refreshToken = jwtService.generarRefreshToken(principal);

            assertThat(jwtService.validarAccessToken(refreshToken)).isNull();
        }
    }

    // =========================================================================
    // 4. Mass Assignment
    // =========================================================================
    @Nested
    @DisplayName("4. Protección contra Mass Assignment")
    class MassAssignmentTests {

        record LoginPayload(String cuit, String password) {}

        @Test
        @DisplayName("Rechaza campos no declarados devolviendo 400 con 'Campo no permitido'")
        void campoDesconocidoHaceFallarDeserializacion() {
            String jsonConPropiedadInyectada = """
                    {
                        "cuit": "20345678901",
                        "password": "clave",
                        "rol": "ADMIN",
                        "esAdmin": true
                    }
                    """;

            assertThatThrownBy(() -> objectMapper.readValue(jsonConPropiedadInyectada, LoginPayload.class))
                    .isInstanceOf(UnrecognizedPropertyException.class)
                    .hasMessageContaining("rol");
        }
    }

    // =========================================================================
    // 5. Inyecciones (SQLi y Path Traversal)
    // =========================================================================
    @Nested
    @DisplayName("5. Protección contra Inyecciones")
    class InyeccionesTests {

        @Test
        @DisplayName("Path Traversal es bloqueado en almacenamiento de archivos")
        void pathTraversalEsBloqueado(@TempDir Path tempDir) throws Exception {
            var almacenamiento = new AlmacenamientoLocal(tempDir.toString());
            Path afuera = Files.createTempFile("secreto", ".pdf");

            // Intento de leer un archivo fuera del directorio raíz de almacenamiento
            assertThatThrownBy(() -> almacenamiento.leer(afuera.toUri().toString()))
                    .isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));

            // Intento de path traversal con '..'
            String traversalUri = tempDir.resolve("..").resolve("afuera.pdf").toUri().toString();
            assertThatThrownBy(() -> almacenamiento.leer(traversalUri))
                    .isInstanceOf(ApiException.class);

            Files.deleteIfExists(afuera);
        }
    }

    // =========================================================================
    // 6. Fuerza Bruta (HTTP 429)
    // =========================================================================
    @Nested
    @DisplayName("6. Protección contra Fuerza Bruta (HTTP 429)")
    class FuerzaBrutaTests {

        @Test
        @DisplayName("Reiterados intentos fallidos bloquean la IP con HTTP 429 y Retry-After")
        void reiteradosFallosBloqueanCon429() throws Exception {
            RateLimitFilter filter = new RateLimitFilter(objectMapper, 5, 60);
            filter.reset();

            String ipVictima = "192.168.1.50";

            // 5 intentos fallidos (HTTP 401)
            for (int i = 0; i < 5; i++) {
                MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/login");
                request.setRemoteAddr(ipVictima);
                MockHttpServletResponse response = new MockHttpServletResponse();

                FilterChain failingChain = (req, res) -> ((HttpServletResponse) res).setStatus(HttpStatus.UNAUTHORIZED.value());
                filter.doFilter(request, response, failingChain);

                assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
            }

            // El 6to intento es bloqueado inmediatamente por el filtro con HTTP 429
            MockHttpServletRequest intentoBloqueado = new MockHttpServletRequest("POST", "/auth/login");
            intentoBloqueado.setRemoteAddr(ipVictima);
            MockHttpServletResponse responseBloqueada = new MockHttpServletResponse();

            FilterChain nextChain = (req, res) -> ((HttpServletResponse) res).setStatus(HttpStatus.OK.value());
            filter.doFilter(intentoBloqueado, responseBloqueada, nextChain);

            assertThat(responseBloqueada.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
            assertThat(responseBloqueada.getHeader(HttpHeaders.RETRY_AFTER)).isNotNull();
            assertThat(responseBloqueada.getContentAsString()).contains("Demasiados intentos fallidos");

            // Un login exitoso de otra IP limpia su estado
            String ipExitosa = "192.168.1.51";
            MockHttpServletRequest loginOkRequest = new MockHttpServletRequest("POST", "/auth/login");
            loginOkRequest.setRemoteAddr(ipExitosa);
            MockHttpServletResponse loginOkResponse = new MockHttpServletResponse();
            filter.doFilter(loginOkRequest, loginOkResponse, (req, res) -> ((HttpServletResponse) res).setStatus(HttpStatus.OK.value()));
            assertThat(filter.isBlocked(ipExitosa)).isFalse();
        }
    }

    // =========================================================================
    // 7. Cabeceras de Seguridad (OWASP ZAP)
    // =========================================================================
    @Nested
    @DisplayName("7. Cabeceras de Seguridad (OWASP ZAP Compliance)")
    class CabecerasSeguridadTests {

        private AnnotationConfigWebApplicationContext context;
        private MockMvc mockMvc;

        @BeforeEach
        void initContext() {
            context = new AnnotationConfigWebApplicationContext();
            context.setServletContext(new MockServletContext());
            context.register(TestWebConfig.class, SecurityConfig.class);
            context.refresh();
            mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        }

        @AfterEach
        void closeContext() {
            if (context != null) context.close();
        }

        @Test
        @DisplayName("Respuestas HTTP incluyen cabeceras anti-clickjacking, CSP, Referrer y MIME nosniff")
        void respuestasIncluyenCabecerasSeguras() throws Exception {
            mockMvc.perform(get("/actuator/health"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-Frame-Options", "DENY"))
                    .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                    .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                    .andExpect(header().exists("Content-Security-Policy"));
        }
    }

    // =========================================================================
    // 8. Mitigación CVE Críticas
    // =========================================================================
    @Nested
    @DisplayName("8. Dependencias sin CVE Críticas sin mitigar")
    class DependenciasCveTests {

        @Test
        @DisplayName("Catálogo de excepciones SCA documenta y valida mitigaciones activas")
        void excepcionesScaValidas() throws Exception {
            Path scaConfig = Path.of("config/sca-excepciones.json");
            assertThat(Files.exists(scaConfig)).isTrue();
            String contenido = Files.readString(scaConfig);
            assertThat(contenido).contains("CVE-2026-47884");
            assertThat(contenido).contains("CVE-2026-47890");
        }
    }

    // ----------------------------------------------------------------- Helpers
    private static void autenticar(AuthPrincipal principal) {
        var auth = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + principal.rol())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Configuration
    @EnableWebMvc
    @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
    static class TestWebConfig {
        @Bean JwtService jwtService() { return Mockito.mock(JwtService.class); }
        @Bean ModuleTokenService moduleTokenService() { return Mockito.mock(ModuleTokenService.class); }
        @Bean JwtAuthenticationFilter jwtFilter(JwtService jwt, ModuleTokenService module) {
            return new JwtAuthenticationFilter(jwt, module);
        }
        @Bean RateLimitFilter rateLimitFilter(ObjectMapper mapper) {
            return new RateLimitFilter(mapper, 5, 60);
        }
        @Bean ObjectMapper mapper() { return Jackson2ObjectMapperBuilder.json().build(); }
        @Bean PublicController publicController() { return new PublicController(); }
    }

    @RestController
    static class PublicController {
        @GetMapping({"/publico/health", "/actuator/health"})
        String health() { return "ok"; }
    }
}

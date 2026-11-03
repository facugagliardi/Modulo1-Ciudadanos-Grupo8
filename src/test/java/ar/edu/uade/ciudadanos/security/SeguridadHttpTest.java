package ar.edu.uade.ciudadanos.security;

import ar.edu.uade.ciudadanos.config.SecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class SeguridadHttpTest {
    AnnotationConfigWebApplicationContext context;
    MockMvc mvc;
    @BeforeEach void iniciar() {
        context=new AnnotationConfigWebApplicationContext(); context.setServletContext(new MockServletContext());
        context.register(Config.class,SecurityConfig.class); context.refresh();
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(context.getBean(JwtService.class).validarAccessToken("valido"))
                .thenReturn(new AuthPrincipal(2L,TipoSujeto.CIUDADANO,"PERSONA"));
        when(context.getBean(ModuleTokenService.class).validar("modulo-valido"))
                .thenReturn(new AuthPrincipal(null,TipoSujeto.SERVICIO,"SERVICIO"));
    }
    @AfterEach void cerrar() { context.close(); }

    @Test void cookieTokenYBasicNoAutenticanPeroBearerExplicitoSi() throws Exception {
        mvc.perform(post("/prueba-segura").cookie(new Cookie("accessToken","valido"),new Cookie("JSESSIONID","valido")))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/prueba-segura").header("Authorization","Basic dXNlcjpwYXNz"))
                .andExpect(status().isUnauthorized());
        var result=mvc.perform(post("/prueba-segura").header("Authorization","Bearer valido"))
                .andExpect(status().isOk()).andExpect(content().string("ok"))
                .andExpect(header().doesNotExist("Set-Cookie")).andReturn();
        assertNull(result.getRequest().getSession(false));
        mvc.perform(post("/integraciones/v1/prueba").header("Authorization","Bearer modulo-valido"))
                .andExpect(status().isOk());
        mvc.perform(post("/prueba-segura").header("Authorization","Bearer modulo-valido"))
                .andExpect(status().isUnauthorized());
    }

    @Test void corsRechazaOrigenAjenoYPermiteSoloOrigenConfiguradoSinCredenciales() throws Exception {
        mvc.perform(options("/prueba-segura").header("Origin","https://ajeno.example")
                        .header("Access-Control-Request-Method","POST").header("Access-Control-Request-Headers","Authorization"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        mvc.perform(options("/prueba-segura").header("Origin","http://localhost:8090")
                        .header("Access-Control-Request-Method","POST").header("Access-Control-Request-Headers","Authorization"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://localhost:8090"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }

    @Configuration @EnableWebMvc @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
    static class Config {
        @Bean JwtService jwtService() { return mock(JwtService.class); }
        @Bean ModuleTokenService moduleTokenService() { return mock(ModuleTokenService.class); }
        @Bean JwtAuthenticationFilter jwtFilter(JwtService jwt, ModuleTokenService module) {
            return new JwtAuthenticationFilter(jwt,module);
        }
        @Bean ObjectMapper mapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean Probe probe() { return new Probe(); }
    }
    @RestController static class Probe {
        @PostMapping({"/prueba-segura", "/integraciones/v1/prueba"}) String post() { return "ok"; }
    }
}

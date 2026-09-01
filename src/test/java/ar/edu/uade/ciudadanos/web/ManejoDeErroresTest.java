package ar.edu.uade.ciudadanos.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.GlobalExceptionHandler;
import ar.edu.uade.ciudadanos.contacto.ContactoController;
import ar.edu.uade.ciudadanos.contacto.ContactoService;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

/**
 * El contrato de errores visto desde HTTP: se levanta un controller real con el
 * mismo ObjectMapper y el mismo @RestControllerAdvice que usa la app, sin
 * contexto de Spring ni bases de datos.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ManejoDeErroresTest {

    @Mock
    private ContactoService contactoService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        // Jackson2ObjectMapperBuilder es el que usa Spring Boot: trae el modulo de
        // java.time ya registrado. Encima, el ajuste de application.yml que
        // convierte a los DTO en la lista blanca de campos aceptados.
        ObjectMapper objectMapper = Jackson2ObjectMapperBuilder.json().build();
        objectMapper.enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new ContactoController(contactoService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .setValidator(validator)
                .build();
    }

    @Test
    void unCampoQueNoEstaEnLaListaBlancaDa400YDiceCualesSeAceptan() throws Exception {
        mockMvc.perform(post("/ciudadanos/1/contactos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"EMAIL","valor":"a@b.com","verificado":true}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("Campo no permitido: 'verificado'")))
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("Campos aceptados")))
                .andExpect(jsonPath("$.path").value("/ciudadanos/1/contactos"));
    }

    @Test
    void unEnumInvalidoDa400YEnumeraLosValores() throws Exception {
        mockMvc.perform(post("/ciudadanos/1/contactos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"FAX","valor":"a@b.com"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("tipo")))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("EMAIL")))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("TELEFONO")));
    }

    @Test
    void unCampoObligatorioFaltanteDa400ConElDetallePorCampo() throws Exception {
        mockMvc.perform(post("/ciudadanos/1/contactos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"EMAIL"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Payload invalido"))
                .andExpect(jsonPath("$.errores.valor").exists());
    }

    @Test
    void unJsonRotoDa400YNo500() throws Exception {
        mockMvc.perform(post("/ciudadanos/1/contactos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipo\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("mal formado")));
    }

    @Test
    void unPathVariableQueNoEsNumeroDa400() throws Exception {
        mockMvc.perform(get("/ciudadanos/abc/contactos"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("se esperaba Long")));
    }

    @Test
    void unaApiExceptionDe404LlegaComo404ConSuMensaje() throws Exception {
        when(contactoService.listar(anyLong()))
                .thenThrow(ApiException.noEncontrado("No existe el ciudadano 99"));

        mockMvc.perform(get("/ciudadanos/99/contactos"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("No existe el ciudadano 99"));
    }

    @Test
    void unConflictoDeNegocioLlegaComo409() throws Exception {
        when(contactoService.crear(anyLong(), any()))
                .thenThrow(ApiException.conflicto("El ciudadano ya tiene registrado ese EMAIL"));

        mockMvc.perform(post("/ciudadanos/1/contactos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"EMAIL","valor":"a@b.com"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("El ciudadano ya tiene registrado ese EMAIL"));
    }

    @Test
    void unErrorInesperadoNoFiltraElDetalleInterno() throws Exception {
        when(contactoService.listar(anyLong())).thenThrow(new IllegalStateException("conexion jdbc caida"));

        mockMvc.perform(get("/ciudadanos/1/contactos"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("Error interno"));
    }
}

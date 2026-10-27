package ar.edu.uade.ciudadanos.evento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.evento.dto.EventEnvelope;
import ar.edu.uade.ciudadanos.evento.dto.ProducerInfo;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedEvent;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedPayload;
import ar.edu.uade.ciudadanos.evento.entity.Evento;
import ar.edu.uade.ciudadanos.evento.entity.TipoEvento;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class EventoControllerTest {

    @Mock private EventoService eventoService;
    @Mock private EventPublisherService eventPublisherService;
    @Mock private EventConsumerService eventConsumerService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private EventoController eventoController;

    @BeforeEach
    void setUp() {
        eventoController = new EventoController(eventoService, eventPublisherService, eventConsumerService, objectMapper);
    }

    @Test
    @DisplayName("GET /eventos debe listar eventos emitidos y recibidos")
    void listarEventos() {
        when(eventoService.listarEmitidos()).thenReturn(List.of(
                new Evento("EVT-1", "citizens", "1", "citizenUpdated", "{}", TipoEvento.EMITIDO)
        ));
        when(eventoService.listarRecibidos()).thenReturn(List.of(
                new Evento("EVT-2", "social", "1", "socialDocumentationRequested", "{}", TipoEvento.RECIBIDO)
        ));

        ListaResponse<Evento> response = eventoController.listar(null);

        assertThat(response.items()).hasSize(2);
    }

    @Test
    @DisplayName("GET /eventos?tipo=EMITIDO debe filtrar solo emitidos")
    void listarEventosFiltrados() {
        when(eventoService.listarEmitidos()).thenReturn(List.of(
                new Evento("EVT-1", "citizens", "1", "citizenUpdated", "{}", TipoEvento.EMITIDO)
        ));

        ListaResponse<Evento> response = eventoController.listar("EMITIDO");

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).getType()).isEqualTo(TipoEvento.EMITIDO);
    }

    @Test
    @DisplayName("GET /eventos/{id} debe devolver el evento buscado")
    void obtenerEventoPorId() {
        Evento evento = new Evento("EVT-100", "citizens", "1", "citizenUpdated", "{}", TipoEvento.EMITIDO);
        when(eventoService.buscarPorId("EVT-100")).thenReturn(Optional.of(evento));

        Evento resultado = eventoController.obtener("EVT-100");

        assertThat(resultado.getEventId()).isEqualTo("EVT-100");
    }

    @Test
    @DisplayName("POST /eventos/publicar-ejemplo/citizen-registered debe invocar al publicador")
    void publicarEjemplo() {
        EventEnvelope<String> mockEnvelope = EventEnvelope.de(
                "M1-EVT-001", "2026-08-20T11:45:00-03:00", "citizenUpdated",
                ProducerInfo.citizensApi(), "citizens/8452", "data"
        );
        when(eventPublisherService.publicarEjemplo("citizen-registered")).thenAnswer(inv -> mockEnvelope);

        ResponseEntity<EventEnvelope<?>> response = eventoController.publicarEjemplo("citizen-registered");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().eventId()).isEqualTo("M1-EVT-001");
        verify(eventPublisherService).publicarEjemplo("citizen-registered");
    }

    @Test
    @DisplayName("POST /eventos/recibir debe almacenar evento entrante genérico en PostgreSQL")
    void recibirEventoGenerico() {
        String json = """
                {
                  "eventId": "EVT-ENTRANTE-999",
                  "eventType": "externalOrderCreated",
                  "subject": "orders/123",
                  "payload": { "total": 500 }
                }
                """;

        when(eventConsumerService.procesarEventoGenericoRecibido(eq("EVT-ENTRANTE-999"), eq("external"), eq("orders/123"), eq("externalOrderCreated"), any()))
                .thenReturn(true);

        ResponseEntity<Map<String, Object>> response = eventoController.recibirEvento(json);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("status", "GUARDADO_RECIBIDO");
        assertThat(response.getBody()).containsEntry("eventId", "EVT-ENTRANTE-999");
    }

    @Test
    @DisplayName("POST /eventos/recibir/social-documentation-requested procesa solicitud de M8")
    void recibirSolicitudM8() {
        SocialDocumentationRequestedEvent evento = new SocialDocumentationRequestedEvent(
                "M8-EVT-1234", "socialDocumentationRequested", "2026-08-21T10:30:00-03:00",
                "social-development", new SocialDocumentationRequestedPayload("c-01", "app-1", "prog-1", List.of(), "2026-09-01", "notas")
        );

        when(eventConsumerService.procesarSocialDocumentationRequested(evento)).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = eventoController.recibirSolicitudDocumentacion(evento);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("status", "PROCESADO_Y_RESPONDIDO");
    }
}

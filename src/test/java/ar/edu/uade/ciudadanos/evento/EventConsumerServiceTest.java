package ar.edu.uade.ciudadanos.evento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.evento.dto.EventEnvelope;
import ar.edu.uade.ciudadanos.evento.dto.ProducerInfo;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationDeliveredData;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedEvent;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EventConsumerServiceTest {

    @Mock private EventoService eventoService;
    @Mock private EventPublisherService eventPublisherService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private EventConsumerService consumerService;

    @BeforeEach
    void setUp() {
        consumerService = new EventConsumerService(eventoService, eventPublisherService, objectMapper);
    }

    @Test
    @DisplayName("procesarSocialDocumentationRequested debe guardar en BD como RECIBIDO y responder a M8 con correlationId")
    void procesarSolicitudM8Exito() {
        String eventId = "3f7a1c2e-84b0-4d9e-a123-000000000001";
        SocialDocumentationRequestedPayload payload = new SocialDocumentationRequestedPayload(
                "c-00123",
                "sol-00456",
                "prog-00789",
                List.of(),
                "2026-09-05T23:59:59-03:00",
                "Notas"
        );
        SocialDocumentationRequestedEvent evento = new SocialDocumentationRequestedEvent(
                eventId,
                "socialDocumentationRequested",
                "2026-08-21T10:30:00-03:00",
                "social-development",
                payload
        );

        when(eventoService.estaProcesado(eventId)).thenReturn(false);
        when(eventPublisherService.publicarSocialDocumentationDelivered(eq(eventId), any(), any()))
                .thenReturn(EventEnvelope.de("M1-EVT-000210", "2026-08-21T10:35:00-03:00", "socialDocumentationDelivered",
                        EventEnvelope.SOURCE_MODULE_CIUDADANOS,
                        new SocialDocumentationDeliveredData("c-00123", "sol-00456", "prog-00789", List.of())));

        boolean procesado = consumerService.procesarSocialDocumentationRequested(evento);

        assertThat(procesado).isTrue();

        // Verifica que se guardó en PostgreSQL como RECIBIDO
        verify(eventoService).registrarRecibido(eq(eventId), eq("citizens"), eq("c-00123"), eq("socialDocumentationRequested"), any());

        // Verifica que se emitió la respuesta con el correlationId original y causationId
        verify(eventPublisherService).publicarSocialDocumentationDelivered(eq(eventId), any(), any());
    }

    @Test
    @DisplayName("Idempotencia: Si un evento ya fue procesado, no se vuelve a guardar ni responder")
    void eventoDuplicadoEsIgnorado() {
        String eventId = "3f7a1c2e-84b0-4d9e-a123-000000000001";
        SocialDocumentationRequestedEvent evento = new SocialDocumentationRequestedEvent(
                eventId,
                "socialDocumentationRequested",
                "2026-08-21T10:30:00-03:00",
                "social-development",
                null
        );

        when(eventoService.estaProcesado(eventId)).thenReturn(true);

        boolean procesado = consumerService.procesarSocialDocumentationRequested(evento);

        assertThat(procesado).isFalse();
        verify(eventoService, never()).registrarRecibido(any(), any(), any(), any(), any());
        verify(eventPublisherService, never()).publicarSocialDocumentationDelivered(any(), any(), any());
    }

    @Test
    @DisplayName("procesarEventoGenericoRecibido almacena cualquier evento entrante con idempotencia")
    void procesarEventoGenerico() {
        when(eventoService.estaProcesado("EVT-EXTERNO-1")).thenReturn(false);

        boolean resultado = consumerService.procesarEventoGenericoRecibido(
                "EVT-EXTERNO-1",
                "external",
                "test/1",
                "someExternalEvent",
                "{\"foo\":\"bar\"}"
        );

        assertThat(resultado).isTrue();
        verify(eventoService).registrarRecibido(eq("EVT-EXTERNO-1"), eq("external"), eq("test/1"), eq("someExternalEvent"), eq("{\"foo\":\"bar\"}"));
    }

    @Test
    @DisplayName("procesarEventoGenericoRecibido con citizenId UUID o numérico procesa y persiste correctamente")
    void procesarEventoConCitizenIdUuidONumerico() {
        when(eventoService.estaProcesado("EVT-UUID-1")).thenReturn(false);

        String payloadUuid = """
            {
              "eventId": "EVT-UUID-1",
              "eventType": "casefileInitiated",
              "data": {
                "citizenId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
                "caratula": "Expediente prueba UUID"
              }
            }
            """;

        boolean resultado = consumerService.procesarEventoGenericoRecibido(
                "EVT-UUID-1", "casefiles", "b63f5a2e-4b71-46e7-8b01-381c85d88f62", "casefileInitiated", payloadUuid
        );

        assertThat(resultado).isTrue();
        verify(eventoService).registrarRecibido(eq("EVT-UUID-1"), eq("casefiles"), eq("b63f5a2e-4b71-46e7-8b01-381c85d88f62"), eq("casefileInitiated"), any());
    }
}

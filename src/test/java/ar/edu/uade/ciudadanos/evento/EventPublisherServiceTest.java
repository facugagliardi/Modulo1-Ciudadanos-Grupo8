package ar.edu.uade.ciudadanos.evento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.evento.dto.CitizenUpdatedData;
import ar.edu.uade.ciudadanos.evento.dto.EventEnvelope;
import ar.edu.uade.ciudadanos.evento.dto.UpdatedBy;
import ar.edu.uade.ciudadanos.evento.entity.Evento;
import ar.edu.uade.ciudadanos.evento.entity.TipoEvento;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class EventPublisherServiceTest {

    @Mock private EventoService eventoService;
    @Mock private RabbitTemplate rabbitTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private EventPublisherService publisherService;

    @BeforeEach
    void setUp() {
        publisherService = new EventPublisherService(eventoService, rabbitTemplate, objectMapper);
        ReflectionTestUtils.setField(publisherService, "exchangeName", "modulo1.topic.exchange");
    }

    @Test
    @DisplayName("publicarCitizenUpdated debe persistir en PostgreSQL como EMITIDO y enviar a RabbitMQ")
    void publicarCitizenUpdatedExito() {
        when(eventoService.registrarEmitido(any(), any(), any(), any()))
                .thenReturn(new Evento("M1-EVT-TEST", "citizens", "100", "citizenUpdated", "{}", TipoEvento.EMITIDO));

        Map<String, Object> details = Map.of("dni", "12345678", "name", "Juan");
        EventEnvelope<CitizenUpdatedData> envelope = publisherService.publicarCitizenUpdated(
                100L,
                "REGISTERED",
                details,
                UpdatedBy.selfService()
        );

        assertThat(envelope).isNotNull();
        assertThat(envelope.eventType()).isEqualTo("citizenUpdated");
        assertThat(envelope.subject()).isEqualTo("citizens/100");

        // Verifica que se guardó en PostgreSQL con el patrón Outbox
        ArgumentCaptor<String> eventIdCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> typeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);

        verify(eventoService).registrarEmitido(eventIdCaptor.capture(), subjectCaptor.capture(), typeCaptor.capture(), payloadCaptor.capture());
        assertThat(subjectCaptor.getValue()).isEqualTo("citizens/100");
        assertThat(typeCaptor.getValue()).isEqualTo("citizenUpdated");
        assertThat(payloadCaptor.getValue()).contains("REGISTERED").contains("Juan");

        // Verifica despacho a RabbitMQ
        verify(rabbitTemplate).convertAndSend(eq("modulo1.topic.exchange"), eq("modulo1.citizens.registered"), eq(envelope));
    }

    @Test
    @DisplayName("Si RabbitMQ falla por desconexión, el evento persiste en BD y no rompe el flujo")
    void rabbitMqDesconectadoToleraFallo() {
        when(eventoService.registrarEmitido(any(), any(), any(), any()))
                .thenReturn(new Evento("M1-EVT-TEST", "citizens", "100", "citizenUpdated", "{}", TipoEvento.EMITIDO));

        doThrow(new AmqpException("Broker no disponible"))
                .when(rabbitTemplate).convertAndSend(any(String.class), any(String.class), any(Object.class));

        // Debe ejecutarse sin lanzar excepción hacia afuera
        EventEnvelope<?> envelope = publisherService.publicarEjemplo("citizen-registered");

        assertThat(envelope).isNotNull();
        verify(eventoService).registrarEmitido(any(), any(), any(), any());
    }

    @Test
    @DisplayName("publicarEjemplo debe generar y publicar todos los ejemplos del catálogo oficial")
    void publicarEjemplosOficiales() {
        when(eventoService.registrarEmitido(any(), any(), any(), any()))
                .thenReturn(new Evento());

        String[] ejemplos = {
                "citizen-registered",
                "citizen-blocked",
                "citizen-deceased",
                "citizen-address-updated",
                "casefile-resolved",
                "citizen-info-delivered",
                "organization-info-delivered",
                "organization-registered",
                "representation-granted",
                "representation-expired",
                "social-documentation-delivered"
        };

        for (String ej : ejemplos) {
            EventEnvelope<?> res = publisherService.publicarEjemplo(ej);
            assertThat(res).as("Ejemplo " + ej).isNotNull();
        }
    }
}

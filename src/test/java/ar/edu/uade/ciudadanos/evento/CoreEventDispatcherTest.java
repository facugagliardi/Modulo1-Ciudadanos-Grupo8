package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.intermodulo.TramitesExternosService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CoreEventDispatcherTest {
    private final TramitesExternosService tramites = mock(TramitesExternosService.class);
    private final EventConsumerService documentos = mock(EventConsumerService.class);
    private final CoreEventDispatcher dispatcher = new CoreEventDispatcher(new ObjectMapper(), tramites, documentos);

    @Test
    void despachaLosSieteEventosSinInterpretarlosComoSolicitudesM8() {
        when(tramites.procesar(any())).thenReturn("APLICADO");
        for (String tipo : TramitesExternosService.EVENTOS) {
            assertThat(dispatcher.procesar("{\"eventType\":\"" + tipo + "\",\"data\":{}}" )).isEqualTo("APLICADO");
        }
        verify(tramites, times(7)).procesar(any());
        verifyNoInteractions(documentos);
    }

    @Test
    void mensajeIrrelevanteSeConfirmaSinCrearEntidades() {
        assertThat(dispatcher.procesar("{\"eventType\":\"paymentRegistered\",\"data\":{}}")).isEqualTo("IGNORADO");
        verifyNoInteractions(tramites, documentos);
    }

    @Test
    void errorDePersistenciaNoSeConfirmaNiReencolaLocalmente() {
        when(tramites.procesar(any())).thenThrow(new IllegalStateException("Base no disponible"));
        Message mensaje = new Message("{\"eventType\":\"ticketCreated\",\"data\":{}}".getBytes(StandardCharsets.UTF_8), new MessageProperties());
        assertThatThrownBy(() -> dispatcher.recibir(mensaje)).isInstanceOf(AmqpRejectAndDontRequeueException.class);
    }

    @Test
    void m8AceptaAmbasGrafiasDeFechaConSlugCanonico() {
        when(documentos.procesarSocialDocumentationRequested(any())).thenReturn(true);
        for (String campo : new String[]{"occurredAt", "occuredAt"}) {
            String json = "{\"eventId\":\"11111111-1111-4111-8111-111111111111\",\"eventType\":\"socialDocumentationRequested\","
                    + "\"sourceModule\":\"desarrollo-social\",\"" + campo + "\":\"2026-10-27T10:00:00-03:00\",\"data\":{}}";
            assertThat(dispatcher.procesar(json)).isEqualTo("APLICADO");
        }
    }
}

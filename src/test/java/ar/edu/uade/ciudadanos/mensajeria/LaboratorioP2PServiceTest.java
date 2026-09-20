package ar.edu.uade.ciudadanos.mensajeria;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jms.core.JmsTemplate;

@ExtendWith(MockitoExtension.class)
class LaboratorioP2PServiceTest {

    @Mock
    private JmsTemplate jmsTemplate;

    @Test
    void enviaElJsonDeSolicitudALaColaConfigurada() {
        LaboratorioP2PService service = new LaboratorioP2PService(jmsTemplate, "documentacion.solicitada");
        EnviarSolicitudDocumentacionRequest request = new EnviarSolicitudDocumentacionRequest(
                42L, "SOL-2026-001", "PROGRAMA-SOCIAL", OffsetDateTime.now().plusDays(2),
                List.of(new EnviarSolicitudDocumentacionRequest.DocumentoRequeridoRequest(
                        "DNI", "Documento de identidad", true)));

        SolicitudDocumentacionMensaje enviado = service.enviar(request);

        ArgumentCaptor<SolicitudDocumentacionMensaje> mensaje =
                ArgumentCaptor.forClass(SolicitudDocumentacionMensaje.class);
        verify(jmsTemplate).convertAndSend(eq("documentacion.solicitada"), mensaje.capture());
        assertNotNull(enviado.mensajeId());
        assertEquals(enviado, mensaje.getValue());
        assertEquals(42L, enviado.ciudadanoId());
        assertEquals("DNI", enviado.documentosRequeridos().getFirst().tipo());
    }
}

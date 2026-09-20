package ar.edu.uade.ciudadanos.mensajeria;

import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jms.core.JmsTemplate;
import org.springframework.stereotype.Service;

/** Productor P2P: publica solicitudes sin esperar que un consumidor este disponible. */
@Service
@ConditionalOnProperty(prefix = "app.mensajeria.p2p", name = "enabled", havingValue = "true")
public class LaboratorioP2PService {

    private final JmsTemplate jmsTemplate;
    private final String colaSolicitudes;

    public LaboratorioP2PService(JmsTemplate jmsTemplate,
                                 @Value("${app.mensajeria.p2p.cola-solicitudes-documentacion}") String colaSolicitudes) {
        this.jmsTemplate = jmsTemplate;
        this.colaSolicitudes = colaSolicitudes;
    }

    public SolicitudDocumentacionMensaje enviar(EnviarSolicitudDocumentacionRequest request) {
        SolicitudDocumentacionMensaje mensaje = new SolicitudDocumentacionMensaje(
                UUID.randomUUID().toString(), request.ciudadanoId(), request.solicitudId(), request.programaId(),
                request.fechaLimite(), request.documentosRequeridos().stream()
                        .map(d -> new SolicitudDocumentacionMensaje.DocumentoRequerido(
                                d.tipo(), d.descripcion(), d.obligatorio()))
                        .toList());
        jmsTemplate.convertAndSend(colaSolicitudes, mensaje);
        return mensaje;
    }
}

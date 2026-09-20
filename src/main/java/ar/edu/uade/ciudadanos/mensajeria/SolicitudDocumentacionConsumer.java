package ar.edu.uade.ciudadanos.mensajeria;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jms.annotation.JmsListener;
import org.springframework.stereotype.Component;

/** Consumidor P2P. Dos listeners compiten por la misma cola durante el laboratorio. */
@Component
@ConditionalOnProperty(prefix = "app.mensajeria.p2p", name = "enabled", havingValue = "true")
public class SolicitudDocumentacionConsumer {

    private static final Logger log = LoggerFactory.getLogger(SolicitudDocumentacionConsumer.class);

    @JmsListener(destination = "${app.mensajeria.p2p.cola-solicitudes-documentacion}", concurrency = "2-2")
    public void procesar(SolicitudDocumentacionMensaje mensaje) {
        log.info("P2P procesado: mensajeId={}, ciudadanoId={}, solicitudId={}, consumidor={}",
                mensaje.mensajeId(), mensaje.ciudadanoId(), mensaje.solicitudId(),
                Thread.currentThread().getName());
    }
}

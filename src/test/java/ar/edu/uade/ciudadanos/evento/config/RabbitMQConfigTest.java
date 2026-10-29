package ar.edu.uade.ciudadanos.evento.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class RabbitMQConfigTest {

    @Test
    void inicializarElAdminNoIntentaDeclararRecursosAdministradosPorCore() {
        ConnectionFactory connectionFactory = mock(ConnectionFactory.class);
        try (var context = new AnnotationConfigApplicationContext()) {
            context.registerBean(ConnectionFactory.class, () -> connectionFactory);
            context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
            context.register(RabbitMQConfig.class);
            context.refresh();

            // Spring invokes this admin on connection creation, including a health
            // check. Without topology to declare it must not open a channel.
            var admin = new RabbitAdmin(connectionFactory);
            admin.setApplicationContext(context);
            admin.initialize();

            verify(connectionFactory, never()).createConnection();
        }
    }
}

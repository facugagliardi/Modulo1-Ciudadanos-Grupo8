package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedEvent;
import ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="M1_TEST_POSTGRES_URL",matches=".+")
class EventConsumerTransaccionPostgresTest {
    @Test void entradaDelListenerRevierteRegistroSiFallaLaCreacionDelExpediente() {
        var ds=new DriverManagerDataSource(System.getenv("M1_TEST_POSTGRES_URL"),System.getenv("M1_TEST_POSTGRES_USER"),System.getenv("M1_TEST_POSTGRES_PASSWORD"));
        var jdbc=new JdbcTemplate(ds);
        String table="prueba_evento_"+UUID.randomUUID().toString().replace("-","");
        jdbc.execute("CREATE TABLE "+table+" (id VARCHAR PRIMARY KEY)");
        try {
            var eventos=mock(EventoService.class);
            when(eventos.registrarRecibido(anyString(),anyString(),anyString(),anyString(),anyString()))
                    .thenAnswer(inv->{ jdbc.update("INSERT INTO "+table+" VALUES (?)",inv.getArgument(0,String.class)); return true; });
            var expedientes=mock(ExpedienteRepository.class);
            when(expedientes.save(any())).thenThrow(new DataIntegrityViolationException("fallo simulado"));
            var event=EventConsumerServiceTest.evento();
            var ciudadanos=mock(ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository.class);
            var ciudadano=new ar.edu.uade.ciudadanos.persona.entity.Ciudadano(); ciudadano.setId(1L);
            when(ciudadanos.findByUuid(UUID.fromString(event.payload().citizenId()))).thenReturn(java.util.Optional.of(ciudadano));
            var solicitudes=mock(ar.edu.uade.ciudadanos.documentacion.repository.SolicitudDocumentacionRepository.class);
            var target=new EventConsumerService(eventos,mock(EventPublisherService.class),new ObjectMapper(),expedientes,solicitudes,ciudadanos);
            var proxy=new ProxyFactory(target);
            proxy.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(ds),new AnnotationTransactionAttributeSource()));
            var consumer=(EventConsumerService)proxy.getProxy();
            assertThrows(DataIntegrityViolationException.class,()->consumer.onSocialDocumentationRequested(event));
            verify(eventos).registrarRecibido(eq(event.eventId()),anyString(),anyString(),anyString(),anyString());
            assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Integer.class));
        } finally { jdbc.execute("DROP TABLE "+table); }
    }
}

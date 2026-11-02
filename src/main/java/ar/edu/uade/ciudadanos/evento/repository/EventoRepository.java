package ar.edu.uade.ciudadanos.evento.repository;

import ar.edu.uade.ciudadanos.evento.entity.Evento;
import ar.edu.uade.ciudadanos.evento.entity.TipoEvento;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EventoRepository extends JpaRepository<Evento, String> {

    List<Evento> findByType(TipoEvento type);

    List<Evento> findByEventType(String eventType);

    List<Evento> findByAggregateTypeAndAggregateId(String aggregateType, String aggregateId);

    List<Evento> findByTypeAndEventType(TipoEvento type, String eventType);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = """
            INSERT INTO events(event_id,aggregate_type,aggregate_id,event_type,payload,type)
            VALUES (:eventId,:aggregateType,:aggregateId,:eventType,:payload,'RECIBIDO')
            ON CONFLICT (event_id) DO NOTHING
            """, nativeQuery = true)
    int insertarRecibido(String eventId, String aggregateType, String aggregateId, String eventType, String payload);

    boolean existsByEventId(String eventId);

    boolean existsByEventIdAndType(String eventId, TipoEvento type);
}

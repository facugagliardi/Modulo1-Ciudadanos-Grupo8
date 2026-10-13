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

    boolean existsByEventId(String eventId);

    boolean existsByEventIdAndType(String eventId, TipoEvento type);
}

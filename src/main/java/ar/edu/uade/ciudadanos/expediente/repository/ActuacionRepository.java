package ar.edu.uade.ciudadanos.expediente.repository;

import ar.edu.uade.ciudadanos.expediente.entity.Actuacion;
import ar.edu.uade.ciudadanos.expediente.entity.ActuacionId;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ActuacionRepository extends JpaRepository<Actuacion, ActuacionId> {

    /** Historial completo, en orden (RF-35). */
    List<Actuacion> findByIdExpedienteIdOrderByIdActuacionIdAsc(Long expedienteId);

    long countByIdExpedienteId(Long expedienteId);

    /** Ultima actuacion, para calcular el proximo numero de orden. */
    Optional<Actuacion> findFirstByIdExpedienteIdOrderByIdActuacionIdDesc(Long expedienteId);
}

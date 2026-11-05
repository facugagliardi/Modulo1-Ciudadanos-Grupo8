package ar.edu.uade.ciudadanos.expediente.repository;

import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.expediente.entity.Expediente;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;

@Repository
public interface ExpedienteRepository extends JpaRepository<Expediente, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Expediente e where e.expedienteId = :id")
    Optional<Expediente> findByIdForUpdate(@Param("id") Long id);

    @Query(value = "SELECT correlation_id FROM proyecto_obra_externo WHERE expediente_id = :id", nativeQuery = true)
    Optional<java.util.UUID> findCorrelacionObra(@Param("id") Long id);

    Optional<Expediente> findByNumero(String numero);

    boolean existsByNumero(String numero);

    List<Expediente> findByCiudadanoId(Long ciudadanoId);

    List<Expediente> findByEstado(EstadoExpediente estado);
}

package ar.edu.uade.ciudadanos.expediente.repository;

import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.expediente.entity.Expediente;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExpedienteRepository extends JpaRepository<Expediente, Long> {

    Optional<Expediente> findByNumero(String numero);

    boolean existsByNumero(String numero);

    List<Expediente> findByPersonaId(Long personaId);

    List<Expediente> findByEstado(EstadoExpediente estado);
}

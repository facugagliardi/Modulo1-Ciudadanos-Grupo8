package ar.edu.uade.ciudadanos.persona.repository;

import ar.edu.uade.ciudadanos.persona.entity.CredencialPersona;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CredencialPersonaRepository extends JpaRepository<CredencialPersona, Long> {

    Optional<CredencialPersona> findByPersonaId(Long personaId);
}

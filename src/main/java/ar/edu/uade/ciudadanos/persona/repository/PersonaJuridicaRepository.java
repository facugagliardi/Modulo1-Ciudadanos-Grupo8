package ar.edu.uade.ciudadanos.persona.repository;

import ar.edu.uade.ciudadanos.persona.entity.PersonaJuridica;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PersonaJuridicaRepository extends JpaRepository<PersonaJuridica, Long> {

    Optional<PersonaJuridica> findByRazonSocialIgnoreCase(String razonSocial);

    List<PersonaJuridica> findByRazonSocialIgnoreCaseContaining(String fragmento);
}

package ar.edu.uade.ciudadanos.persona.repository;

import ar.edu.uade.ciudadanos.persona.entity.IntegrantePersonaJuridica;
import ar.edu.uade.ciudadanos.persona.entity.IntegrantePersonaJuridicaId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IntegrantePersonaJuridicaRepository
        extends JpaRepository<IntegrantePersonaJuridica, IntegrantePersonaJuridicaId> {

    /** Integrantes de una juridica (RF-03). */
    List<IntegrantePersonaJuridica> findByIdIdPersonaJuridica(Long idPersonaJuridica);

    /** Juridicas que integra un ciudadano. */
    List<IntegrantePersonaJuridica> findByIdIdCiudadano(Long idCiudadano);
}

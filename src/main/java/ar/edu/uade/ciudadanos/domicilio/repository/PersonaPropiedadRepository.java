package ar.edu.uade.ciudadanos.domicilio.repository;

import ar.edu.uade.ciudadanos.domicilio.entity.PersonaPropiedad;
import ar.edu.uade.ciudadanos.domicilio.entity.PersonaPropiedadId;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PersonaPropiedadRepository extends JpaRepository<PersonaPropiedad, PersonaPropiedadId> {

    /** Historial completo (incluye cerrados) - GET /personas/{id}/domicilios, RF-11. */
    List<PersonaPropiedad> findByIdIdPersona(Long idPersona);

    List<PersonaPropiedad> findByIdIdPersonaAndVigenteHastaIsNull(Long idPersona);

    /** Domicilio principal vigente - GET /personas/{id}/domicilio-principal. */
    Optional<PersonaPropiedad> findByIdIdPersonaAndEsPrincipalTrueAndVigenteHastaIsNull(Long idPersona);

    List<PersonaPropiedad> findByIdIdPropiedad(Long idPropiedad);
}

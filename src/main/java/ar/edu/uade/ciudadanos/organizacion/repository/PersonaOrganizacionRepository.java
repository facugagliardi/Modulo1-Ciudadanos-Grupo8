package ar.edu.uade.ciudadanos.organizacion.repository;

import ar.edu.uade.ciudadanos.organizacion.entity.PersonaOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.PersonaOrganizacionId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PersonaOrganizacionRepository extends JpaRepository<PersonaOrganizacion, PersonaOrganizacionId> {

    List<PersonaOrganizacion> findByIdIdOrganizacion(Long idOrganizacion);

    List<PersonaOrganizacion> findByIdIdPersona(Long idPersona);
}

package ar.edu.uade.ciudadanos.contacto.repository;

import ar.edu.uade.ciudadanos.contacto.entity.ContactoPersona;
import ar.edu.uade.ciudadanos.contacto.entity.ContactoPersonaId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ContactoPersonaRepository extends JpaRepository<ContactoPersona, ContactoPersonaId> {

    List<ContactoPersona> findByIdCiudadanoId(Long ciudadanoId);

    List<ContactoPersona> findByIdContactoId(Long contactoId);

    void deleteByIdContactoId(Long contactoId);
}

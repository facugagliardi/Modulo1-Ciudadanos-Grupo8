package ar.edu.uade.ciudadanos.domicilio.repository;

import ar.edu.uade.ciudadanos.domicilio.entity.Propiedad;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PropiedadRepository extends JpaRepository<Propiedad, Long> {

    List<Propiedad> findByIdBarrio(UUID idBarrio);

    List<Propiedad> findByCalleIgnoreCaseContaining(String calle);
}

package ar.edu.uade.ciudadanos.persona.repository;

import ar.edu.uade.ciudadanos.persona.entity.Relacion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RelacionRepository extends JpaRepository<Relacion, Long> {

    /** Relaciones donde el ciudadano participa en cualquiera de los dos extremos. */
    List<Relacion> findByCiudadanoId1OrCiudadanoId2(Long ciudadanoId1, Long ciudadanoId2);

    Optional<Relacion> findByCiudadanoId1AndCiudadanoId2(Long ciudadanoId1, Long ciudadanoId2);

    List<Relacion> findByCiudadanoId1AndEsResponsableTrue(Long ciudadanoId1);
}

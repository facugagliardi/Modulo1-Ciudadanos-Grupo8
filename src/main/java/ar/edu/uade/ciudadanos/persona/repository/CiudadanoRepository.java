package ar.edu.uade.ciudadanos.persona.repository;

import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CiudadanoRepository extends JpaRepository<Ciudadano, Long> {

    /** documentoId es el DNI (RF-06, GET /ciudadanos/dni/{dni}). */
    Optional<Ciudadano> findByDocumentoId(String documentoId);

    boolean existsByDocumentoId(String documentoId);

    List<Ciudadano> findByEstado(EstadoCiudadano estado);

    List<Ciudadano> findByApellidoIgnoreCaseContainingOrNombreIgnoreCaseContaining(String apellido, String nombre);
}

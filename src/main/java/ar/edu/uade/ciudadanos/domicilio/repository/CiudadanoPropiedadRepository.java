package ar.edu.uade.ciudadanos.domicilio.repository;

import ar.edu.uade.ciudadanos.domicilio.entity.CiudadanoPropiedad;
import ar.edu.uade.ciudadanos.domicilio.entity.CiudadanoPropiedadId;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CiudadanoPropiedadRepository extends JpaRepository<CiudadanoPropiedad, CiudadanoPropiedadId> {

    List<CiudadanoPropiedad> findByIdIdCiudadano(Long idCiudadano);

    List<CiudadanoPropiedad> findByIdIdCiudadanoAndVigenteHastaIsNull(Long idCiudadano);

    /** Domicilio principal vigente - GET /ciudadanos/{id}/domicilio-principal. */
    Optional<CiudadanoPropiedad> findByIdIdCiudadanoAndEsPrincipalTrueAndVigenteHastaIsNull(Long idCiudadano);

    List<CiudadanoPropiedad> findByIdIdPropiedad(Long idPropiedad);
}

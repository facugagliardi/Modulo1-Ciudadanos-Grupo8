package ar.edu.uade.ciudadanos.organizacion.repository;

import ar.edu.uade.ciudadanos.organizacion.entity.CiudadanoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.CiudadanoOrganizacionId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CiudadanoOrganizacionRepository extends JpaRepository<CiudadanoOrganizacion, CiudadanoOrganizacionId> {
    List<CiudadanoOrganizacion> findByIdIdOrganizacion(Long idOrganizacion);
    List<CiudadanoOrganizacion> findByIdIdCiudadano(Long idCiudadano);
}

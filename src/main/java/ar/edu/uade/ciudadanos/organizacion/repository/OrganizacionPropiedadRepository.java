package ar.edu.uade.ciudadanos.organizacion.repository;

import ar.edu.uade.ciudadanos.organizacion.entity.OrganizacionPropiedad;
import ar.edu.uade.ciudadanos.organizacion.entity.OrganizacionPropiedadId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrganizacionPropiedadRepository extends JpaRepository<OrganizacionPropiedad, OrganizacionPropiedadId> {
    List<OrganizacionPropiedad> findByIdIdOrganizacion(Long organizacionId);
    Optional<OrganizacionPropiedad> findByIdIdOrganizacionAndEsPrincipalTrueAndVigenteHastaIsNull(Long organizacionId);
    Optional<OrganizacionPropiedad> findByIdIdOrganizacionAndIdIdPropiedad(Long organizacionId, Long propiedadId);
}

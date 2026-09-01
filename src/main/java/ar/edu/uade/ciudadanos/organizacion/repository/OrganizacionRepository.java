package ar.edu.uade.ciudadanos.organizacion.repository;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrganizacionRepository extends JpaRepository<Organizacion, Long> {

    Optional<Organizacion> findByCuit(Long cuit);

    Optional<Organizacion> findByTaxId(String taxId);

    boolean existsByCuit(Long cuit);

    boolean existsByTaxId(String taxId);

    List<Organizacion> findByEstado(EstadoOrganizacion estado);

    List<Organizacion> findByRazonSocialIgnoreCaseContaining(String fragmento);
}

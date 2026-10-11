package ar.edu.uade.ciudadanos.persona.repository;

import ar.edu.uade.ciudadanos.persona.entity.CredencialCiudadano;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CredencialCiudadanoRepository extends JpaRepository<CredencialCiudadano, Long> {
    Optional<CredencialCiudadano> findByCiudadano_Cuit(Long cuit);
    Optional<CredencialCiudadano> findByCiudadano_DocumentoId(String documentoId);
}

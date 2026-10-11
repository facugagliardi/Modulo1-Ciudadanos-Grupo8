package ar.edu.uade.ciudadanos.documentacion.repository;

import ar.edu.uade.ciudadanos.documentacion.entity.Documento;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentoRepository extends JpaRepository<Documento, Long> {

    List<Documento> findByCiudadanoId(Long ciudadanoId);

    List<Documento> findByCiudadanoIdAndTipoDocumento(Long ciudadanoId, String tipoDocumento);

    /** Ultima version cargada de un tipo para un ciudadano (RF-24). */
    Optional<Documento> findFirstByCiudadanoIdAndTipoDocumentoOrderByVersionDesc(Long ciudadanoId, String tipoDocumento);
}

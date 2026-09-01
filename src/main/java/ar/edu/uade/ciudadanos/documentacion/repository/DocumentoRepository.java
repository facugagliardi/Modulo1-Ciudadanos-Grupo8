package ar.edu.uade.ciudadanos.documentacion.repository;

import ar.edu.uade.ciudadanos.documentacion.entity.Documento;
import ar.edu.uade.ciudadanos.documentacion.entity.ResultadoValidacion;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentoRepository extends JpaRepository<Documento, Long> {

    List<Documento> findByPersonaId(Long personaId);

    List<Documento> findByPersonaIdAndTipoDocumento(Long personaId, String tipoDocumento);

    /** Ultima version cargada de un tipo para una persona (RF-24). */
    Optional<Documento> findFirstByPersonaIdAndTipoDocumentoOrderByVersionDesc(Long personaId, String tipoDocumento);

    List<Documento> findByResultadoValidacion(ResultadoValidacion resultadoValidacion);

    List<Documento> findByVigenciaHastaBefore(LocalDate fecha);
}

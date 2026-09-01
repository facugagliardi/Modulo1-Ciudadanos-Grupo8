package ar.edu.uade.ciudadanos.documentacion.repository;

import ar.edu.uade.ciudadanos.documentacion.entity.EstadoSolicitud;
import ar.edu.uade.ciudadanos.documentacion.entity.SolicitudDocumentacion;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SolicitudDocumentacionRepository extends JpaRepository<SolicitudDocumentacion, Long> {

    List<SolicitudDocumentacion> findByTitularId(Long titularId);

    List<SolicitudDocumentacion> findByEstado(EstadoSolicitud estado);

    List<SolicitudDocumentacion> findByTitularIdAndEstado(Long titularId, EstadoSolicitud estado);

    /** Pendientes con plazo vencido, para marcarlas VENCIDA (RF-28). */
    List<SolicitudDocumentacion> findByEstadoAndPlazoBefore(EstadoSolicitud estado, LocalDate fecha);
}

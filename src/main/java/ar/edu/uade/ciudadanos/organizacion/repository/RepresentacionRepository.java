package ar.edu.uade.ciudadanos.organizacion.repository;

import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Representacion;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RepresentacionRepository extends JpaRepository<Representacion, Long> {

    List<Representacion> findByOrganizacionId(Long organizacionId);

    List<Representacion> findByPersonaId(Long personaId);

    List<Representacion> findByOrganizacionIdAndEstado(Long organizacionId, EstadoRepresentacion estado);

    /** RF-22: valida que la representacion este VIGENTE y dentro de fechas. */
    @Query("""
            select r from Representacion r
            where r.personaId = :personaId
              and r.organizacionId = :organizacionId
              and r.estado = ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion.VIGENTE
              and r.desde <= :fecha
              and (r.hasta is null or r.hasta >= :fecha)
            """)
    Optional<Representacion> findVigente(@Param("personaId") Long personaId,
                                         @Param("organizacionId") Long organizacionId,
                                         @Param("fecha") LocalDate fecha);

    /** Candidatas a vencimiento automatico (RF-21). */
    @Query("""
            select r from Representacion r
            where r.estado = ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion.VIGENTE
              and r.hasta is not null and r.hasta < :fecha
            """)
    List<Representacion> findVencidasPendientesDeCierre(@Param("fecha") LocalDate fecha);
}

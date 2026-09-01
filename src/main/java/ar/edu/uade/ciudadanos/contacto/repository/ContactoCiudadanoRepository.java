package ar.edu.uade.ciudadanos.contacto.repository;

import ar.edu.uade.ciudadanos.contacto.entity.ContactoCiudadano;
import ar.edu.uade.ciudadanos.contacto.entity.TipoContacto;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ContactoCiudadanoRepository extends JpaRepository<ContactoCiudadano, Long> {

    Optional<ContactoCiudadano> findByTipoAndValor(TipoContacto tipo, String valor);

    /** Contactos de un ciudadano, resueltos a traves de contacto_persona. */
    @Query("""
            select c from ContactoCiudadano c
            where c.contactoId in (
                select cp.id.contactoId from ContactoPersona cp where cp.id.ciudadanoId = :ciudadanoId
            )
            """)
    List<ContactoCiudadano> findByCiudadanoId(@Param("ciudadanoId") Long ciudadanoId);

    /** Busqueda inversa por email/telefono (RF-07). */
    @Query("""
            select cp.id.ciudadanoId from ContactoPersona cp
            where cp.id.contactoId in (
                select c.contactoId from ContactoCiudadano c where lower(c.valor) = lower(:valor)
            )
            """)
    List<Long> findCiudadanoIdsByValor(@Param("valor") String valor);
}

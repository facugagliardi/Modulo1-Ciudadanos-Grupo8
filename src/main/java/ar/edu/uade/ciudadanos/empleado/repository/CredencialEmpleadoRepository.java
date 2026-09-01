package ar.edu.uade.ciudadanos.empleado.repository;

import ar.edu.uade.ciudadanos.empleado.entity.CredencialEmpleado;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CredencialEmpleadoRepository extends JpaRepository<CredencialEmpleado, Long> {

    Optional<CredencialEmpleado> findByEmpleadoId(Long empleadoId);
}

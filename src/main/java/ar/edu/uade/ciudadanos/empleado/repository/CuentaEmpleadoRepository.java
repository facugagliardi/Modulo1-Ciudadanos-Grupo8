package ar.edu.uade.ciudadanos.empleado.repository;

import ar.edu.uade.ciudadanos.empleado.entity.CuentaEmpleado;
import ar.edu.uade.ciudadanos.empleado.entity.RolEmpleado;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CuentaEmpleadoRepository extends JpaRepository<CuentaEmpleado, Long> {

    Optional<CuentaEmpleado> findByMailIgnoreCase(String mail);

    boolean existsByMailIgnoreCase(String mail);

    List<CuentaEmpleado> findByRol(RolEmpleado rol);
}

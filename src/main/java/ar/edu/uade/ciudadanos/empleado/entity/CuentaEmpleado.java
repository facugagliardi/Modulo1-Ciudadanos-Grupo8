package ar.edu.uade.ciudadanos.empleado.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Cuenta de empleado municipal.
 *
 * <p>{@code mail} y {@code activo} se agregan sobre el ERD: el login de empleados
 * ({@code POST /auth/empleados/login}) usa mail y devuelve 403 si esta inactivo.
 */
@Entity
@Table(name = "cuenta_empleado")
public class CuentaEmpleado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "empleado_id")
    private Long empleadoId;

    @Column(name = "mail", nullable = false, unique = true, length = 200)
    private String mail;

    @Column(name = "nombre_empleado", nullable = false, length = 25)
    private String nombreEmpleado;

    @Column(name = "apellido_empleado", nullable = false, length = 25)
    private String apellidoEmpleado;

    @Enumerated(EnumType.STRING)
    @Column(name = "rol", nullable = false, length = 50)
    private RolEmpleado rol;

    @Column(name = "activo", nullable = false)
    private boolean activo = true;

    public Long getEmpleadoId() {
        return empleadoId;
    }

    public void setEmpleadoId(Long empleadoId) {
        this.empleadoId = empleadoId;
    }

    public String getMail() {
        return mail;
    }

    public void setMail(String mail) {
        this.mail = mail;
    }

    public String getNombreEmpleado() {
        return nombreEmpleado;
    }

    public void setNombreEmpleado(String nombreEmpleado) {
        this.nombreEmpleado = nombreEmpleado;
    }

    public String getApellidoEmpleado() {
        return apellidoEmpleado;
    }

    public void setApellidoEmpleado(String apellidoEmpleado) {
        this.apellidoEmpleado = apellidoEmpleado;
    }

    public RolEmpleado getRol() {
        return rol;
    }

    public void setRol(RolEmpleado rol) {
        this.rol = rol;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }
}

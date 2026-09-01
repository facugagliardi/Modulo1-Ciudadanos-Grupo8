package ar.edu.uade.ciudadanos.empleado.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

/** {@code contrasenasEmpleados} del ERD: hash BCrypt de la clave del empleado. */
@Entity
@Table(name = "credencial_empleado")
public class CredencialEmpleado {

    @Id
    @Column(name = "empleado_id")
    private Long empleadoId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empleado_id")
    private CuentaEmpleado empleado;

    @Column(name = "password", nullable = false, length = 100)
    private String password;


    public Long getEmpleadoId() {
        return empleadoId;
    }

    public void setEmpleadoId(Long empleadoId) {
        this.empleadoId = empleadoId;
    }

    public CuentaEmpleado getEmpleado() {
        return empleado;
    }

    public void setEmpleado(CuentaEmpleado empleado) {
        this.empleado = empleado;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}

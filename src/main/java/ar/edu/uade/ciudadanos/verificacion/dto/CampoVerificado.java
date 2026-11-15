package ar.edu.uade.ciudadanos.verificacion.dto;

/** Un dato del formulario contra lo leido en el DNI. */
public record CampoVerificado(
        String campo,
        String etiqueta,
        String ingresado,
        String leido,
        boolean coincide,
        /** Aclaracion para el usuario, o null. */
        String detalle) {
}

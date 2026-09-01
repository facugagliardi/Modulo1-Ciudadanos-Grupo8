package ar.edu.uade.ciudadanos.security;

/** Contra que tabla se autentico el portador del token. */
public enum TipoSujeto {
    CIUDADANO,
    JURIDICA,
    EMPLEADO,
    /** Token de servicio para llamadas inter-modulo (Svc). */
    SERVICIO
}

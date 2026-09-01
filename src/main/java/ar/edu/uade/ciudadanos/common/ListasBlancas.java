package ar.edu.uade.ciudadanos.common;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Valores aceptados en los campos de texto libre del modelo.
 *
 * <p>El diagrama los define como VARCHAR sin restringir, asi que sin esto entra
 * cualquier cosa y el dato queda inconsistente entre modulos. Se valida contra
 * lista blanca: lo que no esta enumerado se rechaza con 400 y el mensaje incluye
 * los valores validos, para que el front no tenga que adivinarlos.
 */
public final class ListasBlancas {

    /** Tipos de vinculo familiar (RF-16, RF-17). */
    public static final Set<String> TIPOS_RELACION = orden(
            "PADRE", "MADRE", "HIJO", "HIJA", "CONYUGE", "CONVIVIENTE",
            "HERMANO", "HERMANA", "TUTOR", "TUTELADO", "APODERADO", "OTRO");

    /** Tipos de propiedad/domicilio (RF-09). */
    public static final Set<String> TIPOS_PROPIEDAD = orden(
            "CASA", "DEPARTAMENTO", "LOCAL", "OFICINA", "GALPON", "TERRENO", "OTRO");

    /** Alcances de una representacion (RF-20). */
    public static final Set<String> ALCANCES_REPRESENTACION = orden(
            "TOTAL", "TRAMITES", "FIRMA", "CONSULTA");

    /** Tipos de documento admitidos (RF-23, RF-27). */
    public static final Set<String> TIPOS_DOCUMENTO = orden(
            "DNI", "PASAPORTE", "CUIL", "CUIT", "ESTATUTO", "PODER",
            "CONSTANCIA_CUIT", "PARTIDA_NACIMIENTO", "CERTIFICADO_DOMICILIO",
            "CERTIFICADO_DISCAPACIDAD", "OTRO");

    /** Formas juridicas de una organizacion (RF-02). */
    public static final Set<String> TIPOS_ORGANIZACION = orden(
            "SA", "SRL", "SAS", "COOPERATIVA", "FUNDACION", "ASOCIACION_CIVIL",
            "ONG", "UNIPERSONAL", "OTRO");

    /** Tipos de actuacion dentro de un expediente (RF-33). */
    public static final Set<String> TIPOS_ACTUACION = orden(
            "INICIO", "PASE", "NOTIFICACION", "DICTAMEN", "RESOLUCION",
            "PEDIDO_DOCUMENTACION", "ARCHIVO", "OTRO");

    private ListasBlancas() {
    }

    /**
     * Normaliza a mayusculas y verifica contra la lista.
     *
     * @return el valor normalizado, listo para persistir
     * @throws ApiException 400 si el valor no esta permitido
     */
    public static String exigir(String valor, Set<String> permitidos, String campo) {
        if (valor == null || valor.isBlank()) {
            throw ApiException.invalido(campo + " es obligatorio");
        }
        String normalizado = valor.trim().toUpperCase();
        if (!permitidos.contains(normalizado)) {
            throw ApiException.invalido(
                    campo + " invalido: '" + valor + "'. Valores permitidos: " + String.join(", ", permitidos));
        }
        return normalizado;
    }

    /** Igual que {@link #exigir}, pero deja pasar el null (campo opcional). */
    public static String exigirSiPresente(String valor, Set<String> permitidos, String campo) {
        return valor == null ? null : exigir(valor, permitidos, campo);
    }

    private static Set<String> orden(String... valores) {
        return Set.copyOf(new LinkedHashSet<>(java.util.Arrays.asList(valores)));
    }
}

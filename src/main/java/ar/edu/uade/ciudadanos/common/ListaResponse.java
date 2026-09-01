package ar.edu.uade.ciudadanos.common;

import java.util.List;

/**
 * Envoltorio de los GET de listado: la spec v2 los define como
 * {@code {items: [...]}} y sin paginado (el filtrado lo hace el front).
 */
public record ListaResponse<T>(List<T> items) {

    public static <T> ListaResponse<T> de(List<T> items) {
        return new ListaResponse<>(items);
    }
}

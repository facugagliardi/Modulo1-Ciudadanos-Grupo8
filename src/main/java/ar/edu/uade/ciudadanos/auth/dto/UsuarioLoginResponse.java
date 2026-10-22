package ar.edu.uade.ciudadanos.auth.dto;

import ar.edu.uade.ciudadanos.contacto.dto.ContactoResponse;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record UsuarioLoginResponse(
        @JsonProperty("user_id")
        Long user_id,

        Integer dni,

        String nombre,

        String apellido,

        Long cuit,

        String role,

        boolean auth,

        List<ContactoResponse> contactos
) {
    public UsuarioLoginResponse(Long user_id, Integer dni, String role, boolean auth) {
        this(user_id, dni, null, null, null, role, auth, null);
    }

    public UsuarioLoginResponse(Long user_id, Integer dni, String nombre, String apellido, Long cuit, String role, boolean auth) {
        this(user_id, dni, nombre, apellido, cuit, role, auth, null);
    }
}

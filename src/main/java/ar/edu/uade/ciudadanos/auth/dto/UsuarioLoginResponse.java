package ar.edu.uade.ciudadanos.auth.dto;

import ar.edu.uade.ciudadanos.contacto.dto.ContactoResponse;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record UsuarioLoginResponse(
        @JsonProperty("user_id")
        Long user_id,

        UUID uuid,

        Integer dni,

        String nombre,

        String apellido,

        Long cuit,

        String role,

        boolean auth,

        List<ContactoResponse> contactos,

        String actorType
) {
    public UsuarioLoginResponse(Long user_id, UUID uuid, Integer dni, String nombre, String apellido,
                                Long cuit, String role, boolean auth, List<ContactoResponse> contactos) {
        this(user_id, uuid, dni, nombre, apellido, cuit, role, auth, contactos, "CIUDADANO");
    }

    @JsonProperty("actorId")
    public UUID actorId() { return uuid; }

    @JsonProperty("citizenId")
    public UUID citizenId() { return "CIUDADANO".equals(actorType) ? uuid : null; }

    public UsuarioLoginResponse(Long user_id, Integer dni, String role, boolean auth) {
        this(user_id, null, dni, null, null, null, role, auth, null);
    }

    public UsuarioLoginResponse(Long user_id, Integer dni, String nombre, String apellido, Long cuit, String role, boolean auth) {
        this(user_id, null, dni, nombre, apellido, cuit, role, auth, null);
    }

    public UsuarioLoginResponse(Long user_id, Integer dni, String nombre, String apellido, Long cuit, String role, boolean auth, List<ContactoResponse> contactos) {
        this(user_id, null, dni, nombre, apellido, cuit, role, auth, contactos);
    }
}

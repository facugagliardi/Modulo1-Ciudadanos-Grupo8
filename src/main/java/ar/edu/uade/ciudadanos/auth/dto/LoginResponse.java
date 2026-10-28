package ar.edu.uade.ciudadanos.auth.dto;

import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Cuerpo de 200 en POST /auth/login. El token va en los headers. */
public record LoginResponse(Long personaId, String tipoPersona, String rol, UUID uuid) {
    @JsonProperty("citizenId")
    public UUID citizenId() { return uuid; }

    @JsonProperty("actorId")
    public UUID actorId() { return uuid; }

    @JsonProperty("actorType")
    public String actorType() { return "CIUDADANO"; }

    public LoginResponse(Long personaId, String tipoPersona, String rol) {
        this(personaId, tipoPersona, rol, null);
    }
}

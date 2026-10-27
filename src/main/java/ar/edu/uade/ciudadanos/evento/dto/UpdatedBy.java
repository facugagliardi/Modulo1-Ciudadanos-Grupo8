package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record UpdatedBy(String type, Long id) {

    public static UpdatedBy selfService() {
        return new UpdatedBy("SELF_SERVICE", null);
    }

    public static UpdatedBy selfService(Long citizenId) {
        return new UpdatedBy("SELF_SERVICE", citizenId);
    }

    public static UpdatedBy areaUser(Long id) {
        return new UpdatedBy("AREA_USER", id);
    }

    public static UpdatedBy areaUser(String id) {
        if (id == null || id.isBlank()) {
            return new UpdatedBy("AREA_USER", null);
        }
        try {
            return new UpdatedBy("AREA_USER", Long.parseLong(id));
        } catch (NumberFormatException e) {
            String digits = id.replaceAll("\\D", "");
            Long parsed = digits.isEmpty() ? null : Long.parseLong(digits);
            return new UpdatedBy("AREA_USER", parsed);
        }
    }
}

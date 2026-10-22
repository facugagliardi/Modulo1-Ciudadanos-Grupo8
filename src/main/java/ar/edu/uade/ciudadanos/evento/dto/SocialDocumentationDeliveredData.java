package ar.edu.uade.ciudadanos.evento.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SocialDocumentationDeliveredData(
        Long citizenId,
        String applicationId,
        String programId,
        List<Map<String, Object>> files
) {
    public SocialDocumentationDeliveredData(String citizenIdStr, String applicationId, String programId, List<Map<String, Object>> files) {
        this(parseNumericId(citizenIdStr), applicationId, programId, files);
    }

    private static Long parseNumericId(String str) {
        if (str == null || str.isBlank()) {
            return 8452L;
        }
        try {
            return Long.parseLong(str);
        } catch (NumberFormatException e) {
            String digits = str.replaceAll("\\D", "");
            return digits.isEmpty() ? 8452L : Long.parseLong(digits);
        }
    }
}

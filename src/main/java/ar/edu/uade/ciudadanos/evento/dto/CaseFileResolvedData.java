package ar.edu.uade.ciudadanos.evento.dto;

import ar.edu.uade.ciudadanos.expediente.entity.Expediente;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Contrato M3 v0.7: solo una resolucion administrativa real puede producir esta respuesta. */
public record CaseFileResolvedData(UUID caseFileId, String caseFileNumber, String state, String resolution,
        Map<String, Object> externalReference, String resolutionSummary) {
    public CaseFileResolvedData {
        if (caseFileId == null || caseFileNumber == null || caseFileNumber.isBlank()
                || !"resolved".equals(state) || resolution == null || !Set.of("approved", "rejected").contains(resolution)
                || resolutionSummary == null || resolutionSummary.isBlank()
                || externalReference == null || externalReference.size() != 2
                || !"PUBLIC_WORKS_PROJECT".equals(externalReference.get("type"))) {
            throw new IllegalArgumentException("Resolucion de obra incompleta");
        }
        Object id = externalReference.get("id");
        if (!(id instanceof String value) || !UUID.fromString(value).toString().equalsIgnoreCase(value)) {
            throw new IllegalArgumentException("La referencia del proyecto debe ser UUID");
        }
        externalReference = Map.copyOf(externalReference);
    }

    public static CaseFileResolvedData preparar(Expediente expediente, String resultado, String resumen) {
        if (expediente.getEstado() != EstadoExpediente.RESUELTO || expediente.getPublicWorksProjectId() == null) {
            throw new IllegalArgumentException("El expediente debe estar resuelto y vinculado a una obra");
        }
        return new CaseFileResolvedData(expediente.getUuid(), expediente.getNumero(), "resolved", resultado,
                Map.of("type", "PUBLIC_WORKS_PROJECT", "id", expediente.getPublicWorksProjectId().toString()), resumen);
    }
}

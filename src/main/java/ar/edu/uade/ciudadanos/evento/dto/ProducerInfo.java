package ar.edu.uade.ciudadanos.evento.dto;

public record ProducerInfo(String moduleId, String service) {

    public static ProducerInfo citizensApi() {
        return new ProducerInfo("M1", "citizens-api");
    }

    public static ProducerInfo expedientesApi() {
        return new ProducerInfo("M1", "expedientes-api");
    }

    public static ProducerInfo organizationsApi() {
        return new ProducerInfo("M1", "organizations-api");
    }
}

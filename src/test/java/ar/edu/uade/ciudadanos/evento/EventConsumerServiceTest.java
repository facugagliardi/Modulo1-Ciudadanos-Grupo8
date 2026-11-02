package ar.edu.uade.ciudadanos.evento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.evento.dto.EventEnvelope;
import ar.edu.uade.ciudadanos.evento.dto.ProducerInfo;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationDeliveredData;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedEvent;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EventConsumerServiceTest {

    @Mock private EventoService eventoService;
    @Mock private EventPublisherService eventPublisherService;

    @Mock private ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository ciudadanos;
    @Mock private ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository expedientes;
    @Mock private ar.edu.uade.ciudadanos.documentacion.repository.SolicitudDocumentacionRepository solicitudes;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private EventConsumerService consumerService;

    @BeforeEach
    void setUp() {
        consumerService = new EventConsumerService(eventoService, eventPublisherService, objectMapper, expedientes, solicitudes, ciudadanos);
    }

    @Test
    @DisplayName("procesarSocialDocumentationRequested debe guardar en BD como RECIBIDO y responder a M8 con correlationId")
    void procesarSolicitudM8Exito() {
        var evento = evento();
        conocido(evento);
        when(eventoService.registrarRecibido(any(), any(), any(), any(), any())).thenReturn(true);
        when(expedientes.save(any())).thenAnswer(i -> i.getArgument(0));
        when(solicitudes.save(any())).thenAnswer(i -> i.getArgument(0));
        assertThat(consumerService.procesarSocialDocumentationRequested(evento)).isTrue();
        var captor = org.mockito.ArgumentCaptor.forClass(SocialDocumentationDeliveredData.class);
        verify(eventPublisherService).publicarSocialDocumentationDelivered(eq(evento.eventId()), eq(evento.correlationId()), captor.capture());
        var respuesta = captor.getValue();
        assertThat(respuesta.programEditionId()).isEqualTo(evento.payload().programEditionId());
        var file = respuesta.files().getFirst();
        java.util.UUID.fromString((String) file.get("fileId"));
        assertThat(file.toString()).contains("INCOME_CERTIFICATE").contains((String) evento.payload().requiredDocuments().getFirst().get("requirementId"));
        verify(solicitudes).save(org.mockito.ArgumentMatchers.argThat(sol -> sol.getPlazo() == null
                && sol.getTipoDocumento().equals("OTRO") && sol.getContextoSocial().contains(evento.payload().applicationId())));
    }

    @Test
    @DisplayName("Idempotencia: Si un evento ya fue procesado, no se vuelve a guardar ni responder")
    void eventoDuplicadoEsIgnorado() {
        String eventId = "3f7a1c2e-84b0-4d9e-a123-000000000001";
        SocialDocumentationRequestedEvent evento = new SocialDocumentationRequestedEvent(
                eventId,
                "socialDocumentationRequested",
                "2026-08-21T10:30:00-03:00",
                "social-development",
                null
        );

        when(eventoService.estaProcesado(eventId)).thenReturn(true);

        boolean procesado = consumerService.procesarSocialDocumentationRequested(evento);

        assertThat(procesado).isFalse();
        verify(eventoService, never()).registrarRecibido(any(), any(), any(), any(), any());
        verify(eventPublisherService, never()).publicarSocialDocumentationDelivered(any(), any(), any());
    }

    @Test
    @DisplayName("procesarEventoGenericoRecibido almacena cualquier evento entrante con idempotencia")
    void procesarEventoGenerico() {
        when(eventoService.registrarRecibido(any(), any(), any(), any(), any())).thenReturn(true);

        boolean resultado = consumerService.procesarEventoGenericoRecibido(
                "EVT-EXTERNO-1",
                "external",
                "test/1",
                "someExternalEvent",
                "{\"foo\":\"bar\"}"
        );

        assertThat(resultado).isTrue();
        verify(eventoService).registrarRecibido(eq("EVT-EXTERNO-1"), eq("external"), eq("test/1"), eq("someExternalEvent"), eq("{\"foo\":\"bar\"}"));
    }

    @Test
    @DisplayName("procesarEventoGenericoRecibido con citizenId UUID o numérico procesa y persiste correctamente")
    void procesarEventoConCitizenIdUuidONumerico() {
        when(eventoService.registrarRecibido(any(), any(), any(), any(), any())).thenReturn(true);

        var c = new ar.edu.uade.ciudadanos.persona.entity.Ciudadano(); c.setId(8L);
        when(ciudadanos.findByUuid(any())).thenReturn(java.util.Optional.of(c));
        when(expedientes.save(any())).thenAnswer(i -> i.getArgument(0));
        String payloadUuid = """
            {
              "eventId": "EVT-UUID-1",
              "eventType": "casefileInitiated",
              "data": {
                "citizenId": "b63f5a2e-4b71-46e7-8b01-381c85d88f62",
                "caratula": "Expediente prueba UUID"
              }
            }
            """;

        boolean resultado = consumerService.procesarEventoGenericoRecibido(
                "EVT-UUID-1", "casefiles", "b63f5a2e-4b71-46e7-8b01-381c85d88f62", "casefileInitiated", payloadUuid
        );

        assertThat(resultado).isTrue();
        verify(eventoService).registrarRecibido(eq("EVT-UUID-1"), eq("casefiles"), eq("b63f5a2e-4b71-46e7-8b01-381c85d88f62"), eq("casefileInitiated"), any());
    }

    @Test void ciudadanoDesconocidoNoCreaNiRegistraNada() {
        var e = evento();
        org.junit.jupiter.api.Assertions.assertThrows(ar.edu.uade.ciudadanos.common.ApiException.class,
                () -> consumerService.procesarSocialDocumentationRequested(e));
        org.mockito.Mockito.verifyNoInteractions(expedientes, solicitudes, eventPublisherService);
        verify(eventoService, never()).registrarRecibido(any(), any(), any(), any(), any());
        verify(ciudadanos, never()).findAll();
    }

    @Test void ciudadanoNumericoNoSeInterpretaComoOtroTitular() {
        var e = evento();
        var p = e.payload();
        var invalido = new SocialDocumentationRequestedEvent(e.eventId(), e.eventType(), e.eventVersion(), e.occuredAt(),
                e.sourceModule(), e.correlationId(), null, new SocialDocumentationRequestedPayload("1", p.applicationId(),
                p.programId(), p.requiredDocuments(), null, null, null, p.programEditionId()));
        org.junit.jupiter.api.Assertions.assertThrows(ar.edu.uade.ciudadanos.common.ApiException.class,
                () -> consumerService.procesarSocialDocumentationRequested(invalido));
        org.mockito.Mockito.verifyNoInteractions(ciudadanos, expedientes, solicitudes, eventPublisherService);
    }

    @Test void entregaConcurrenteDuplicadaNoCreaEntidades() {
        var e = evento(); conocido(e);
        when(eventoService.registrarRecibido(any(), any(), any(), any(), any())).thenReturn(false);
        assertThat(consumerService.procesarSocialDocumentationRequested(e)).isFalse();
        org.mockito.Mockito.verifyNoInteractions(expedientes, solicitudes, eventPublisherService);
    }

    @Test void segundoEventoDelMismoTramiteNoCreaOtroExpediente() {
        var e = evento(); conocido(e);
        when(eventoService.registrarRecibido(any(), any(), any(), any(), any())).thenReturn(true);
        when(expedientes.existsByNumero("EXP-M8-" + e.payload().applicationId())).thenReturn(true);
        org.junit.jupiter.api.Assertions.assertThrows(ar.edu.uade.ciudadanos.common.ApiException.class,
                () -> consumerService.procesarSocialDocumentationRequested(e));
        verify(expedientes, never()).save(any());
        org.mockito.Mockito.verifyNoInteractions(solicitudes, eventPublisherService);
    }

    static SocialDocumentationRequestedEvent evento() {
        return new SocialDocumentationRequestedEvent(java.util.UUID.randomUUID().toString(), "socialDocumentationRequested", "1.0",
                "2026-11-01T12:00:00-03:00", "desarrollo-social", java.util.UUID.randomUUID().toString(), null,
                new SocialDocumentationRequestedPayload(java.util.UUID.randomUUID().toString(), java.util.UUID.randomUUID().toString(),
                        java.util.UUID.randomUUID().toString(), List.of(java.util.Map.of("requirementId", java.util.UUID.randomUUID().toString(),
                        "type", "INCOME_CERTIFICATE", "name", "Certificado de ingresos", "description", "Grupo familiar", "required", true)),
                        null, "Menos de 90 dias", "SOL-456", java.util.UUID.randomUUID().toString()));
    }

    private void conocido(SocialDocumentationRequestedEvent e) {
        var c = new ar.edu.uade.ciudadanos.persona.entity.Ciudadano(); c.setId(8L);
        when(ciudadanos.findByUuid(java.util.UUID.fromString(e.payload().citizenId()))).thenReturn(java.util.Optional.of(c));
    }
}

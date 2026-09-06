package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.persona.dto.AgregarIntegranteRequest;
import ar.edu.uade.ciudadanos.persona.dto.DatosPersona;
import ar.edu.uade.ciudadanos.persona.dto.IntegranteResponse;
import ar.edu.uade.ciudadanos.persona.dto.PersonaJuridicaResponse;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.IntegrantePersonaJuridica;
import ar.edu.uade.ciudadanos.persona.entity.IntegrantePersonaJuridicaId;
import ar.edu.uade.ciudadanos.persona.entity.PersonaJuridica;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.IntegrantePersonaJuridicaRepository;
import ar.edu.uade.ciudadanos.persona.repository.PersonaJuridicaRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PersonaJuridicaService {

    private final PersonaJuridicaRepository personaJuridicaRepository;
    private final IntegrantePersonaJuridicaRepository integranteRepository;
    private final CiudadanoRepository ciudadanoRepository;
    private final AutorizacionService autorizacion;
    private final PersonaDirectorioService directorio;

    public PersonaJuridicaService(PersonaJuridicaRepository personaJuridicaRepository,
                                  IntegrantePersonaJuridicaRepository integranteRepository,
                                  CiudadanoRepository ciudadanoRepository,
                                  AutorizacionService autorizacion,
                                  PersonaDirectorioService directorio) {
        this.personaJuridicaRepository = personaJuridicaRepository;
        this.integranteRepository = integranteRepository;
        this.ciudadanoRepository = ciudadanoRepository;
        this.autorizacion = autorizacion;
        this.directorio = directorio;
    }

    private PersonaJuridica buscar(Long id) {
        return personaJuridicaRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("Persona juridica no encontrada"));
    }

    @Transactional(readOnly = true)
    public PersonaJuridicaResponse obtener(Long id) {
        autorizacion.exigirLecturaSobrePersonaJuridica(id);
        PersonaJuridica pj = buscar(id);
        
        List<IntegranteResponse> integrantes = integranteRepository.findByIdIdPersonaJuridica(id).stream()
                .map(i -> {
                    DatosPersona p = directorio.resolver(i.getId().getIdCiudadano());
                    return new IntegranteResponse(p.personaId(), p.dni(), p.nombre(), p.apellido());
                })
                .toList();
                
        return new PersonaJuridicaResponse(
                pj.getId(),
                String.valueOf(pj.getPersona().getCuit()),
                pj.getRazonSocial(),
                pj.getNombre(),
                pj.getEstado().name(),
                pj.getFechaDeCreacion(),
                integrantes
        );
    }

    @Transactional
    public void agregarIntegrante(Long idJuridica, AgregarIntegranteRequest request) {
        buscar(idJuridica);
        autorizacion.exigirEscrituraSobrePersonaJuridica(idJuridica);

        Ciudadano ciudadano = ciudadanoRepository.findById(request.ciudadanoId())
                .orElseThrow(() -> ApiException.noEncontrado("El ciudadano especificado no existe"));

        IntegrantePersonaJuridicaId clave = new IntegrantePersonaJuridicaId(ciudadano.getId(), idJuridica);
        if (integranteRepository.existsById(clave)) {
            throw ApiException.conflicto("El ciudadano ya es integrante de esta persona juridica");
        }

        integranteRepository.save(new IntegrantePersonaJuridica(clave));
    }

    @Transactional
    public void quitarIntegrante(Long idJuridica, Long ciudadanoId) {
        buscar(idJuridica);
        autorizacion.exigirEscrituraSobrePersonaJuridica(idJuridica);

        IntegrantePersonaJuridicaId clave = new IntegrantePersonaJuridicaId(ciudadanoId, idJuridica);
        if (!integranteRepository.existsById(clave)) {
            throw ApiException.noEncontrado("El ciudadano no es integrante de la persona juridica");
        }
        
        integranteRepository.deleteById(clave);
    }
}

package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.persona.dto.DatosPersona;
import ar.edu.uade.ciudadanos.persona.entity.Persona;
import ar.edu.uade.ciudadanos.persona.entity.TipoPersona;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.PersonaJuridicaRepository;
import ar.edu.uade.ciudadanos.persona.repository.PersonaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resuelve un personaId a sus datos identificatorios sin que quien pregunta
 * tenga que saber si es fisica o juridica. Lo usan duenos, representaciones y
 * documentacion, que trabajan contra {@code persona} y no contra una subtabla.
 */
@Service
public class PersonaDirectorioService {

    private final PersonaRepository personaRepository;
    private final CiudadanoRepository ciudadanoRepository;
    private final PersonaJuridicaRepository personaJuridicaRepository;

    public PersonaDirectorioService(PersonaRepository personaRepository,
                                    CiudadanoRepository ciudadanoRepository,
                                    PersonaJuridicaRepository personaJuridicaRepository) {
        this.personaRepository = personaRepository;
        this.ciudadanoRepository = ciudadanoRepository;
        this.personaJuridicaRepository = personaJuridicaRepository;
    }

    @Transactional(readOnly = true)
    public DatosPersona resolver(Long personaId) {
        Persona persona = personaRepository.findById(personaId)
                .orElseThrow(() -> ApiException.noEncontrado("No existe la persona " + personaId));
        String cuit = String.valueOf(persona.getCuit());

        if (persona.getTipo() == TipoPersona.CIUDADANO) {
            return ciudadanoRepository.findById(personaId)
                    .map(c -> new DatosPersona(personaId, c.getDocumentoId(), c.getNombre(), c.getApellido(), cuit))
                    .orElseGet(() -> new DatosPersona(personaId, null, null, null, cuit));
        }

        return personaJuridicaRepository.findById(personaId)
                .map(j -> new DatosPersona(personaId, null, j.getRazonSocial(), null, cuit))
                .orElseGet(() -> new DatosPersona(personaId, null, null, null, cuit));
    }

    @Transactional(readOnly = true)
    public void exigirQueExista(Long personaId) {
        if (!personaRepository.existsById(personaId)) {
            throw ApiException.noEncontrado("No existe la persona " + personaId);
        }
    }
}

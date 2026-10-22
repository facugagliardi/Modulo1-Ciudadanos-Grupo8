package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.persona.dto.DatosPersona;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CiudadanoDirectorioService {

    private final CiudadanoRepository ciudadanoRepository;

    public CiudadanoDirectorioService(CiudadanoRepository ciudadanoRepository) {
        this.ciudadanoRepository = ciudadanoRepository;
    }

    @Transactional(readOnly = true)
    public DatosPersona resolver(Long ciudadanoId) {
        return ciudadanoRepository.findById(ciudadanoId)
                .map(c -> new DatosPersona(ciudadanoId, c.getDocumentoId(), c.getNombre(), c.getApellido(), String.valueOf(c.getCuit())))
                .orElseThrow(() -> ApiException.noEncontrado("No existe el ciudadano " + ciudadanoId));
    }

    @Transactional(readOnly = true)
    public void exigirQueExista(Long ciudadanoId) {
        if (!ciudadanoRepository.existsById(ciudadanoId)) {
            throw ApiException.noEncontrado("No existe el ciudadano " + ciudadanoId);
        }
    }

    @Transactional(readOnly = true)
    public boolean existe(Long ciudadanoId) {
        return ciudadanoId != null && ciudadanoRepository.existsById(ciudadanoId);
    }
}

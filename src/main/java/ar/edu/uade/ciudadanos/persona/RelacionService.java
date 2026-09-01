package ar.edu.uade.ciudadanos.persona;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListasBlancas;
import ar.edu.uade.ciudadanos.persona.dto.ActualizarRelacionRequest;
import ar.edu.uade.ciudadanos.persona.dto.CrearRelacionRequest;
import ar.edu.uade.ciudadanos.persona.dto.RelacionDeCiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.dto.RelacionResponse;
import ar.edu.uade.ciudadanos.persona.dto.ResponsableResponse;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.Relacion;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.RelacionRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Grupo familiar (RF-16, RF-17, RF-18). */
@Service
public class RelacionService {

    private final RelacionRepository relacionRepository;
    private final CiudadanoRepository ciudadanoRepository;
    private final AutorizacionService autorizacion;

    public RelacionService(RelacionRepository relacionRepository,
                           CiudadanoRepository ciudadanoRepository,
                           AutorizacionService autorizacion) {
        this.relacionRepository = relacionRepository;
        this.ciudadanoRepository = ciudadanoRepository;
        this.autorizacion = autorizacion;
    }

    @Transactional
    public RelacionResponse crear(CrearRelacionRequest request) {
        if (request.ciudadanoId1().equals(request.ciudadanoId2())) {
            throw ApiException.invalido("Un ciudadano no puede relacionarse consigo mismo");
        }
        Ciudadano uno = buscarCiudadano(request.ciudadanoId1());
        Ciudadano dos = buscarCiudadano(request.ciudadanoId2());
        exigirAccesoAAlgunExtremo(uno.getId(), dos.getId());

        if (yaExisteEntre(uno.getId(), dos.getId())) {
            throw ApiException.conflicto("Ya existe una relacion entre esos dos ciudadanos");
        }

        Relacion relacion = new Relacion();
        relacion.setCiudadanoId1(uno.getId());
        relacion.setCiudadanoId2(dos.getId());
        relacion.setRelacionCiudadano1(
                ListasBlancas.exigir(request.relacionCiudadano1(), ListasBlancas.TIPOS_RELACION, "relacionCiudadano1"));
        relacion.setRelacionCiudadano2(
                ListasBlancas.exigir(request.relacionCiudadano2(), ListasBlancas.TIPOS_RELACION, "relacionCiudadano2"));
        relacion.setEsResponsable(Boolean.TRUE.equals(request.esResponsable()));

        return RelacionResponse.de(relacionRepository.save(relacion));
    }

    /** Devuelve el otro extremo ya resuelto, mire desde donde mire. */
    @Transactional(readOnly = true)
    public List<RelacionDeCiudadanoResponse> listarDe(Long ciudadanoId) {
        buscarCiudadano(ciudadanoId);
        autorizacion.exigirLecturaDePersona(ciudadanoId);

        return relacionRepository.findByCiudadanoId1OrCiudadanoId2(ciudadanoId, ciudadanoId).stream()
                .map(r -> {
                    boolean consultadoEsElUno = r.getCiudadanoId1().equals(ciudadanoId);
                    Long otroId = consultadoEsElUno ? r.getCiudadanoId2() : r.getCiudadanoId1();
                    // El tipo que aplica es el del OTRO extremo: describe que es
                    // el otro para el ciudadano consultado.
                    String tipo = consultadoEsElUno ? r.getRelacionCiudadano2() : r.getRelacionCiudadano1();
                    Ciudadano otro = ciudadanoRepository.findById(otroId).orElse(null);
                    return new RelacionDeCiudadanoResponse(r.getRelacionId(), otroId,
                            otro == null ? null : otro.getNombre(),
                            otro == null ? null : otro.getApellido(),
                            tipo, r.isEsResponsable());
                })
                .toList();
    }

    @Transactional
    public RelacionResponse actualizar(Long relacionId, ActualizarRelacionRequest request) {
        Relacion relacion = buscar(relacionId);
        exigirAccesoAAlgunExtremo(relacion.getCiudadanoId1(), relacion.getCiudadanoId2());

        relacion.setRelacionCiudadano1(
                ListasBlancas.exigir(request.relacionCiudadano1(), ListasBlancas.TIPOS_RELACION, "relacionCiudadano1"));
        relacion.setRelacionCiudadano2(
                ListasBlancas.exigir(request.relacionCiudadano2(), ListasBlancas.TIPOS_RELACION, "relacionCiudadano2"));

        return RelacionResponse.de(relacion);
    }

    /** RF-18: quien queda a cargo (menores, personas a cargo). */
    @Transactional
    public ResponsableResponse cambiarResponsable(Long relacionId, boolean esResponsable) {
        Relacion relacion = buscar(relacionId);
        exigirAccesoAAlgunExtremo(relacion.getCiudadanoId1(), relacion.getCiudadanoId2());

        if (relacion.isEsResponsable() == esResponsable) {
            throw ApiException.invalido("La relacion ya tiene esResponsable en " + esResponsable);
        }
        relacion.setEsResponsable(esResponsable);

        return new ResponsableResponse(relacionId, esResponsable, OffsetDateTime.now());
    }

    @Transactional
    public void eliminar(Long relacionId) {
        Relacion relacion = buscar(relacionId);
        exigirAccesoAAlgunExtremo(relacion.getCiudadanoId1(), relacion.getCiudadanoId2());
        relacionRepository.delete(relacion);
    }

    // ------------------------------------------------------------------ helpers

    /** El par es simetrico: hay que mirar las dos orientaciones. */
    private boolean yaExisteEntre(Long unoId, Long dosId) {
        return relacionRepository.findByCiudadanoId1AndCiudadanoId2(unoId, dosId).isPresent()
                || relacionRepository.findByCiudadanoId1AndCiudadanoId2(dosId, unoId).isPresent();
    }

    private void exigirAccesoAAlgunExtremo(Long unoId, Long dosId) {
        if (autorizacion.puede(Permiso.EDITAR_TERCEROS)) {
            return;
        }
        Long propio = autorizacion.actual().id();
        if (!propio.equals(unoId) && !propio.equals(dosId)) {
            throw ApiException.prohibido("Solo podes administrar relaciones en las que participas");
        }
    }

    private Relacion buscar(Long relacionId) {
        return relacionRepository.findById(relacionId)
                .orElseThrow(() -> ApiException.noEncontrado("No existe la relacion " + relacionId));
    }

    private Ciudadano buscarCiudadano(Long id) {
        return ciudadanoRepository.findById(id)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el ciudadano " + id));
    }
}

package ar.edu.uade.ciudadanos.contacto;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.contacto.dto.ActualizarContactoRequest;
import ar.edu.uade.ciudadanos.contacto.dto.ContactoCreadoResponse;
import ar.edu.uade.ciudadanos.contacto.dto.ContactoResponse;
import ar.edu.uade.ciudadanos.contacto.dto.ContactoVerificadoResponse;
import ar.edu.uade.ciudadanos.contacto.dto.CrearContactoRequest;
import ar.edu.uade.ciudadanos.contacto.entity.ContactoCiudadano;
import ar.edu.uade.ciudadanos.contacto.entity.ContactoPersona;
import ar.edu.uade.ciudadanos.contacto.entity.ContactoPersonaId;
import ar.edu.uade.ciudadanos.contacto.entity.TipoContacto;
import ar.edu.uade.ciudadanos.contacto.repository.ContactoCiudadanoRepository;
import ar.edu.uade.ciudadanos.contacto.repository.ContactoPersonaRepository;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.Permiso;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Medios de contacto de un ciudadano (RF-13, RF-14, RF-15). */
@Service
public class ContactoService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s.]+\\.[^@\\s]{2,}$");
    /** Telefono argentino: opcional +54, entre 8 y 15 digitos, admite espacios y guiones. */
    private static final Pattern TELEFONO = Pattern.compile("^\\+?[0-9][0-9\\s-]{7,19}$");

    private final ContactoCiudadanoRepository contactoRepository;
    private final ContactoPersonaRepository contactoPersonaRepository;
    private final CiudadanoRepository ciudadanoRepository;
    private final AutorizacionService autorizacion;

    public ContactoService(ContactoCiudadanoRepository contactoRepository,
                           ContactoPersonaRepository contactoPersonaRepository,
                           CiudadanoRepository ciudadanoRepository,
                           AutorizacionService autorizacion) {
        this.contactoRepository = contactoRepository;
        this.contactoPersonaRepository = contactoPersonaRepository;
        this.ciudadanoRepository = ciudadanoRepository;
        this.autorizacion = autorizacion;
    }

    @Transactional
    public ContactoCreadoResponse crear(Long ciudadanoId, CrearContactoRequest request) {
        exigirCiudadano(ciudadanoId);
        autorizacion.exigirEscrituraSobrePersona(ciudadanoId);

        String valor = normalizarYValidar(request.tipo(), request.valor());
        if (yaLoTiene(ciudadanoId, request.tipo(), valor)) {
            throw ApiException.conflicto("El ciudadano ya tiene registrado ese " + request.tipo());
        }

        ContactoCiudadano contacto = new ContactoCiudadano();
        contacto.setTipo(request.tipo());
        contacto.setValor(valor);
        contacto.setVerificado(false);
        contactoRepository.save(contacto);

        contactoPersonaRepository.save(
                new ContactoPersona(new ContactoPersonaId(ciudadanoId, contacto.getContactoId())));

        return new ContactoCreadoResponse(contacto.getContactoId(), ciudadanoId, contacto.getTipo(),
                contacto.getValor(), contacto.isVerificado(), contacto.getCreadoEn());
    }

    @Transactional(readOnly = true)
    public List<ContactoResponse> listar(Long ciudadanoId) {
        exigirCiudadano(ciudadanoId);
        autorizacion.exigirLecturaDePersona(ciudadanoId);
        return contactoRepository.findByCiudadanoId(ciudadanoId).stream().map(ContactoResponse::de).toList();
    }

    /** Cambiar el valor invalida la verificacion anterior: hay que volver a verificar. */
    @Transactional
    public ContactoResponse actualizar(Long contactoId, ActualizarContactoRequest request) {
        ContactoCiudadano contacto = buscar(contactoId);
        exigirAccesoAlContacto(contactoId);

        String valor = normalizarYValidar(request.tipo(), request.valor());
        contacto.setTipo(request.tipo());
        contacto.setValor(valor);
        contacto.setVerificado(false);
        contacto.setVerificadoEn(null);

        return ContactoResponse.de(contacto);
    }

    @Transactional
    public void eliminar(Long contactoId) {
        ContactoCiudadano contacto = buscar(contactoId);
        exigirAccesoAlContacto(contactoId);

        contactoPersonaRepository.deleteByIdContactoId(contactoId);
        contactoRepository.delete(contacto);
    }

    /**
     * RF-14.
     *
     * <p>ATENCION: todavia no hay emision ni almacenamiento de codigos, asi que
     * cualquier codigo de 6 digitos da por verificado el contacto. Falta la
     * tabla de codigos y el envio por mail/SMS (ver README).
     */
    @Transactional
    public ContactoVerificadoResponse verificar(Long contactoId, String codigo) {
        ContactoCiudadano contacto = buscar(contactoId);
        exigirAccesoAlContacto(contactoId);

        if (contacto.isVerificado()) {
            throw ApiException.conflicto("El contacto ya estaba verificado");
        }

        contacto.setVerificado(true);
        contacto.setVerificadoEn(OffsetDateTime.now());
        return new ContactoVerificadoResponse(contacto.getContactoId(), true, contacto.getVerificadoEn());
    }

    // ------------------------------------------------------------------ helpers

    /** Normaliza (mail en minusculas, telefono sin separadores) y valida el formato. */
    private String normalizarYValidar(TipoContacto tipo, String valorCrudo) {
        String valor = valorCrudo.trim();
        if (tipo == TipoContacto.EMAIL) {
            valor = valor.toLowerCase();
            if (!EMAIL.matcher(valor).matches()) {
                throw ApiException.invalido("El email no tiene un formato valido");
            }
            return valor;
        }
        if (!TELEFONO.matcher(valor).matches()) {
            throw ApiException.invalido(
                    "El telefono no tiene un formato valido (8 a 15 digitos, opcionalmente con +54)");
        }
        return valor.replaceAll("[\\s-]", "");
    }

    private boolean yaLoTiene(Long ciudadanoId, TipoContacto tipo, String valor) {
        return contactoRepository.findByCiudadanoId(ciudadanoId).stream()
                .anyMatch(c -> c.getTipo() == tipo && c.getValor().equalsIgnoreCase(valor));
    }

    private ContactoCiudadano buscar(Long contactoId) {
        return contactoRepository.findById(contactoId)
                .orElseThrow(() -> ApiException.noEncontrado("No existe el contacto " + contactoId));
    }

    private void exigirCiudadano(Long ciudadanoId) {
        if (!ciudadanoRepository.existsById(ciudadanoId)) {
            throw ApiException.noEncontrado("No existe el ciudadano " + ciudadanoId);
        }
    }

    /** Un contacto se toca si sos interno o si sos alguno de sus titulares. */
    private void exigirAccesoAlContacto(Long contactoId) {
        if (autorizacion.puede(Permiso.EDITAR_TERCEROS)) {
            return;
        }
        Long propio = autorizacion.actual().id();
        boolean esTitular = contactoPersonaRepository.findByIdContactoId(contactoId).stream()
                .anyMatch(cp -> cp.getId().getCiudadanoId().equals(propio));
        if (!esTitular) {
            throw ApiException.prohibido("No tenes permiso sobre ese contacto");
        }
    }
}

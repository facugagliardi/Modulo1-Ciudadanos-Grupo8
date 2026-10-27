/** Un espacio suelto adentro de un `inline-block` colapsa y la palabra se pega. */
const ESPACIO = " ";

/**
 * **Un texto que rueda letra por letra** al pasar el mouse o al enfocarlo: la
 * palabra se va para arriba y la misma entra desde abajo, en una ola que arranca
 * por la izquierda. Es el `TextoRoll` de ZetaAccounting, que lo usa en el menú
 * del teléfono; acá también va ahí (`MenuMovil`).
 *
 * Quien lo pone tiene que llevar `.rueda`: el disparador es el elemento que se
 * toca —el enlace entero, con su padding—, no la banda, que mide lo que el texto.
 *
 * Son dos copias del texto y, en cada letra, su posición del recorrido en `--p`:
 * 0 la primera, 1 la última. El CSS (`menuMovil.css`) multiplica esa fracción por
 * un barrido fijo, así una palabra larga tarda lo mismo que una corta.
 */
export function TextoRoll({ texto }) {
  return (
    <span className="roll">
      {/* El texto sin partir es para el lector de pantalla: una palabra con un
          `<span>` por letra la deletrea. Las capas van con `aria-hidden`. */}
      <span className="roll__oculto">{texto}</span>
      <Letras texto={texto} className="roll__capa roll__capa--sale" />
      <Letras texto={texto} className="roll__capa roll__capa--entra" />
    </span>
  );
}

function Letras({ texto, className }) {
  /* Por punto de código y no `split("")`, que parte al medio lo que no entra en
     el plano básico. */
  const letras = [...texto];
  const ultima = letras.length - 1;
  return (
    <span className={`roll__letras ${className}`} aria-hidden="true">
      {letras.map((letra, i) => (
        <span
          key={i}
          className="roll__letra"
          style={{ "--p": ultima > 0 ? Number((i / ultima).toFixed(4)) : 0 }}
        >
          {letra === " " ? ESPACIO : letra}
        </span>
      ))}
    </span>
  );
}

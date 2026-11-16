/**
 * Achica una foto antes de subirla. Las fotos del celular pesan 3-8 MB y el
 * backend acepta hasta 1,5 MB por foto del DNI; a 1600 px de lado el texto
 * del documento se sigue leyendo perfecto.
 *
 * Devuelve un File JPEG. Si el navegador no puede decodificar la imagen (por
 * ejemplo, HEIC de iPhone en Chrome) tira un Error con un mensaje para mostrar.
 */
export async function comprimirImagen(archivo, { ladoMaximo = 1600, calidad = 0.85 } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No pudimos abrir esa imagen. Probá con una foto JPG o PNG.");
  }

  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d").drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close?.();

  const blob = await new Promise((resolver) => lienzo.toBlob(resolver, "image/jpeg", calidad));
  if (!blob) throw new Error("No pudimos procesar la imagen. Probá con otra foto.");

  const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], nombre, { type: "image/jpeg" });
}

/**
 * Une frente y dorso en UNA sola imagen: frente arriba, dorso abajo, con una
 * franja blanca en el medio. Groq cobra un cupo fijo de tokens por imagen, así
 * que mandar una en vez de dos casi duplica las verificaciones por minuto del
 * plan gratis.
 *
 * Las dos fotos se llevan al mismo ancho; si el resultado queda más alto que
 * `altoMaximo`, se achica todo junto para no perder proporción.
 */
export async function unirFrenteYDorso(
  frente,
  dorso,
  { ancho = 1280, altoMaximo = 2400, separacion = 24, calidad = 0.85 } = {},
) {
  let arriba;
  let abajo;
  try {
    [arriba, abajo] = await Promise.all([
      createImageBitmap(frente, { imageOrientation: "from-image" }),
      createImageBitmap(dorso, { imageOrientation: "from-image" }),
    ]);
  } catch {
    throw new Error("No pudimos procesar las fotos. Probá con fotos JPG o PNG.");
  }

  const altoDe = (bitmap) => (bitmap.height * ancho) / bitmap.width;
  const altoTotal = altoDe(arriba) + separacion + altoDe(abajo);
  const escala = Math.min(1, altoMaximo / altoTotal);

  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(altoTotal * escala);
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);

  const altoArriba = Math.round(altoDe(arriba) * escala);
  ctx.drawImage(arriba, 0, 0, lienzo.width, altoArriba);
  ctx.drawImage(
    abajo,
    0,
    altoArriba + Math.round(separacion * escala),
    lienzo.width,
    Math.round(altoDe(abajo) * escala),
  );
  arriba.close?.();
  abajo.close?.();

  const blob = await new Promise((resolver) => lienzo.toBlob(resolver, "image/jpeg", calidad));
  if (!blob) throw new Error("No pudimos procesar las fotos. Probá con otras.");
  return new File([blob], "dni-frente-y-dorso.jpg", { type: "image/jpeg" });
}

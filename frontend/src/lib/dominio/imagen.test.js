import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { comprimirImagen, unirFrenteYDorso } from "./imagen.js";

const frente = new File(["frente"], "frente.png", { type: "image/png" });
const dorso = new File(["dorso"], "dorso.png", { type: "image/png" });

describe("imágenes del DNI", () => {
  let decodificar;
  let dibujar;
  let rellenar;
  let codificar;
  let lienzo;

  beforeEach(() => {
    decodificar = vi.fn();
    vi.stubGlobal("createImageBitmap", decodificar);
    dibujar = vi.fn();
    rellenar = vi.fn();
    codificar = vi.fn((entregar) => entregar(new Blob(["jpeg"], { type: "image/jpeg" })));
    lienzo = {
      getContext: vi.fn(() => ({ drawImage: dibujar, fillRect: rellenar })),
      toBlob: codificar,
    };
    vi.spyOn(document, "createElement").mockReturnValue(lienzo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("comprime manteniendo la relación de aspecto y cierra el bitmap", async () => {
    const bitmap = { width: 3200, height: 1600, close: vi.fn() };
    decodificar.mockResolvedValue(bitmap);

    const imagen = await comprimirImagen(frente);

    expect(decodificar).toHaveBeenCalledWith(frente, { imageOrientation: "from-image" });
    expect(dibujar).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 800);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(imagen).toMatchObject({ name: "frente.jpg", type: "image/jpeg" });
  });

  it("conserva las dimensiones de una foto chica y usa la calidad solicitada", async () => {
    const bitmap = { width: 400, height: 600 };
    decodificar.mockResolvedValue(bitmap);

    await comprimirImagen(dorso, { ladoMaximo: 700, calidad: 0.7 });

    expect(dibujar).toHaveBeenCalledWith(bitmap, 0, 0, 400, 600);
    expect(codificar).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.7);
  });

  it("une las caras en orden, con separación y dentro del alto máximo", async () => {
    const arriba = { width: 100, height: 100, close: vi.fn() };
    const abajo = { width: 200, height: 200, close: vi.fn() };
    decodificar.mockResolvedValueOnce(arriba).mockResolvedValueOnce(abajo);

    const imagen = await unirFrenteYDorso(frente, dorso, {
      ancho: 100, altoMaximo: 110, separacion: 20,
    });

    expect(rellenar).toHaveBeenCalledWith(0, 0, 50, 110);
    expect(dibujar).toHaveBeenNthCalledWith(1, arriba, 0, 0, 50, 50);
    expect(dibujar).toHaveBeenNthCalledWith(2, abajo, 0, 60, 50, 50);
    expect(arriba.close).toHaveBeenCalledOnce();
    expect(abajo.close).toHaveBeenCalledOnce();
    expect(imagen).toMatchObject({ name: "dni-frente-y-dorso.jpg", type: "image/jpeg" });
  });

  it("informa si el navegador no puede leer la foto", async () => {
    decodificar.mockRejectedValue(new Error("formato incompatible"));

    await expect(comprimirImagen(frente)).rejects.toThrow("Probá con una foto JPG o PNG");
    await expect(unirFrenteYDorso(frente, dorso)).rejects.toThrow("Probá con fotos JPG o PNG");
    expect(dibujar).not.toHaveBeenCalled();
  });

  it("informa un fallo al generar el JPEG", async () => {
    decodificar.mockResolvedValue({ width: 100, height: 60 });
    codificar.mockImplementation((entregar) => entregar(null));

    await expect(comprimirImagen(frente)).rejects.toThrow("Probá con otra foto");
    await expect(unirFrenteYDorso(frente, dorso)).rejects.toThrow("Probá con otras");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { autenticar, ErrorApi, get, mensajeAmable, pedir } from "./cliente";
import { abrirSesion, cerrarSesion, obtenerAccessToken, obtenerSesion } from "../auth/almacen";
import { jwtFalso, respuestaDeLogin } from "@/pruebas/jwt";

function respuesta(cuerpo, { status = 200, headers = {} } = {}) {
  return new Response(cuerpo === null ? null : JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function errorDelBackend({ status, message, errores }) {
  return respuesta(
    { timestamp: "2026-09-05T10:00:00-03:00", status, error: "x", message, errores, path: "/x" },
    { status },
  );
}

beforeEach(() => {
  cerrarSesion();
  vi.restoreAllMocks();
});

describe("autenticación", () => {
  it("lee los tokens de los headers, no del cuerpo", () => {
    // Es la trampa número uno del backend: el cuerpo trae los datos de sesión
    // y los tokens viajan en Authorization / X-Refresh-Token.
    const access = jwtFalso({ sub: "3", sub_type: "CIUDADANO", rol: "PERSONA" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuestaDeLogin({
          cuerpo: { personaId: 3, tipoPersona: "CIUDADANO", rol: "PERSONA" },
          access,
        }),
      ),
    );

    return autenticar("/auth/login", { cuit: "20345678901", password: "x" }).then((sesion) => {
      expect(sesion.accessToken).toBe(access);
      expect(sesion.refreshToken).toBe("refresh-1");
      expect(sesion.id).toBe(3);
      expect(sesion.subType).toBe("CIUDADANO");
      expect(sesion.rol).toBe("PERSONA");
    });
  });

  it("falla claro si el servidor no manda el token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({ personaId: 3 })));
    await expect(autenticar("/auth/login", {})).rejects.toThrow(/no devolvió el token/i);
  });

  it("agrega el Bearer en cada pedido cuando hay sesión", async () => {
    abrirSesion({ accessToken: jwtFalso({ sub: "3" }), refreshToken: "r", cuerpo: {} });
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await get("/ciudadanos");

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Bearer ${obtenerAccessToken()}`,
    );
  });
});

describe("renovación del token", () => {
  it("ante un 401 refresca una vez y repite el pedido original", async () => {
    abrirSesion({ accessToken: jwtFalso({ sub: "3" }), refreshToken: "refresh-viejo", cuerpo: {} });
    const nuevoAccess = jwtFalso({ sub: "3", iat: 2 });

    const fetchMock = vi
      .fn()
      // 1) el pedido original: el token venció
      .mockResolvedValueOnce(respuesta({ message: "Token ausente o invalido" }, { status: 401 }))
      // 2) el refresh: 204 y tokens nuevos en headers
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: {
            Authorization: `Bearer ${nuevoAccess}`,
            "X-Refresh-Token": "refresh-nuevo",
            "X-Token-Expires-In": "900",
          },
        }),
      )
      // 3) el reintento, ya con el token nuevo
      .mockResolvedValueOnce(respuesta({ items: [{ id: 1 }] }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await get("/ciudadanos");

    expect(res.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/);
    // Rota el par completo: hay que guardar también el refresh nuevo.
    expect(obtenerSesion().refreshToken).toBe("refresh-nuevo");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(`Bearer ${nuevoAccess}`);
  });

  it("varios 401 simultáneos comparten un solo refresh", async () => {
    // Sin esto, cada pedido rotaría el token por su cuenta y los últimos
    // refresh quedarían inválidos.
    abrirSesion({ accessToken: jwtFalso({ sub: "3" }), refreshToken: "r", cuerpo: {} });
    const nuevo = jwtFalso({ sub: "3", iat: 9 });

    const fetchMock = vi.fn().mockImplementation((url) => {
      if (String(url).endsWith("/auth/refresh")) {
        return Promise.resolve(
          new Response(null, {
            status: 204,
            headers: { Authorization: `Bearer ${nuevo}`, "X-Refresh-Token": "r2" },
          }),
        );
      }
      const token = fetchMock.mock.calls.at(-1)?.[1]?.headers?.Authorization;
      return Promise.resolve(
        token === `Bearer ${nuevo}`
          ? respuesta({ ok: true })
          : respuesta({ message: "vencido" }, { status: 401 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([get("/a"), get("/b"), get("/c")]);

    const refrescos = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"));
    expect(refrescos).toHaveLength(1);
  });

  it("si el refresh falla, cierra la sesión y avisa", async () => {
    abrirSesion({ accessToken: jwtFalso({ sub: "3" }), refreshToken: "r", cuerpo: {} });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ message: "vencido" }, { status: 401 }))
        .mockResolvedValueOnce(respuesta({ message: "refresh vencido" }, { status: 401 })),
    );

    await expect(get("/ciudadanos")).rejects.toMatchObject({ status: 401 });
    expect(obtenerSesion()).toBeNull();
  });

  it("no intenta refrescar en el login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ message: "credenciales" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(autenticar("/auth/login", { cuit: "1", password: "x" })).rejects.toBeInstanceOf(
      ErrorApi,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("respuestas y errores", () => {
  it("un 204 devuelve null en vez de reventar al parsear", async () => {
    abrirSesion({ accessToken: jwtFalso({}), refreshToken: "r", cuerpo: {} });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(pedir("/contactos/1", { metodo: "DELETE" })).resolves.toBeNull();
  });

  it("conserva el detalle campo por campo de los 400 de validación", async () => {
    abrirSesion({ accessToken: jwtFalso({}), refreshToken: "r", cuerpo: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        errorDelBackend({
          status: 400,
          message: "Error de validación",
          errores: { valor: "valor es obligatorio" },
        }),
      ),
    );

    const error = await pedir("/ciudadanos/1/contactos", { metodo: "POST", cuerpo: {} }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.status).toBe(400);
    expect(error.tieneErroresDeCampo).toBe(true);
    expect(error.errores.valor).toMatch(/obligatorio/);
  });

  it("no fija Content-Type cuando manda un archivo", async () => {
    // Lo tiene que poner el navegador con su boundary; fijarlo a mano rompe
    // la subida.
    abrirSesion({ accessToken: jwtFalso({}), refreshToken: "r", cuerpo: {} });
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ documentoId: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("archivo", new Blob(["x"]), "dni.pdf");
    await pedir("/personas/3/documentos", { metodo: "POST", form });

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Content-Type");
  });

  it("un fallo de red se convierte en un mensaje entendible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await get("/ciudadanos").catch((e) => e);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/conectarnos con el servidor/i);
  });
});

describe("mensajeAmable", () => {
  it("esconde los errores de contrato, que son bugs nuestros", () => {
    // "Campo no permitido" significa que el front mandó de más: no es culpa
    // del usuario y no tiene sentido mostrárselo.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e = new ErrorApi({
      status: 400,
      message: "Campo no permitido: 'verificado'. Campos aceptados: tipo, valor",
    });
    expect(mensajeAmable(e)).toMatch(/equipo técnico/i);
    expect(console.error).toHaveBeenCalled();
  });

  it("deja pasar el mensaje del backend cuando es útil", () => {
    const e = new ErrorApi({
      status: 403,
      message: "Tu rol (MESA_ENTRADAS) no tiene permiso para validar documentacion.",
    });
    expect(mensajeAmable(e)).toMatch(/MESA_ENTRADAS/);
  });

  it("traduce el 413 a algo accionable", () => {
    expect(mensajeAmable(new ErrorApi({ status: 413 }))).toMatch(/10 MB/);
  });

  it("no se rompe con un error que no es del cliente", () => {
    expect(mensajeAmable(new Error("otra cosa"))).toMatch(/inesperado/i);
  });
});

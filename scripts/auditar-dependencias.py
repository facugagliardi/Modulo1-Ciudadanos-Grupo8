"""Scan resolved Java dependencies or images and retain every raw finding."""

import argparse
import datetime as dt
import json
from pathlib import Path
import re
import subprocess
import sys


def evaluar(reporte, excepciones, ambito):
    filas = []
    if not reporte.get("Results"):
        raise ValueError("El scanner no identifico ningun componente; no es un resultado limpio")
    paquetes = sum(len(r.get("Packages", [])) for r in reporte["Results"])
    if not paquetes:
        raise ValueError("El reporte no contiene inventario de paquetes")
    for resultado in reporte["Results"]:
        for alerta in resultado.get("Vulnerabilities", []):
            clave = (alerta["VulnerabilityID"], alerta["PkgName"], alerta["InstalledVersion"])
            revision = excepciones.get(clave)
            if revision and ambito not in revision.get("ambitos", []):
                revision = None
            filas.append({
                "id": clave[0], "paquete": clave[1], "version": clave[2],
                "severidad": alerta["Severity"], "objetivo": resultado["Target"],
                "revision": revision,
                "bloquea": alerta["Severity"] in ("HIGH", "CRITICAL") and not revision,
            })
    return {"paquetes": paquetes, "hallazgos": filas}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trivy", default="trivy")
    parser.add_argument("--cache-dir")
    parser.add_argument("--report-dir", required=True)
    parser.add_argument("--sbom")
    parser.add_argument("--imagen", action="append", default=[], help="nombre=referencia")
    parser.add_argument("--excepciones", default="config/sca-excepciones.json")
    args = parser.parse_args()
    if not args.sbom and not args.imagen:
        parser.error("Indicar --sbom o al menos una --imagen")
    politica = json.loads(Path(args.excepciones).read_text(encoding="utf-8"))
    if dt.date.today() > dt.date.fromisoformat(politica["vence"]):
        raise ValueError("La revision de excepciones SCA vencio; volver a evaluar")
    excepciones = {}
    for item in politica["excepciones"]:
        if not all(item.get(k) for k in ("justificacion", "fuente", "control", "estado", "ambitos")):
            raise ValueError("Excepcion sin justificacion, fuente o control")
        clave = (item["id"], item["paquete"], item["version"])
        if clave in excepciones:
            raise ValueError("Excepcion duplicada")
        excepciones[clave] = item
    destino = Path(args.report_dir).resolve()
    destino.mkdir(parents=True, exist_ok=True)
    objetivos = [("java", "sbom", args.sbom)] if args.sbom else []
    for imagen in args.imagen:
        nombre, separador, referencia = imagen.partition("=")
        if not separador or not re.fullmatch(r"[a-z0-9-]+", nombre) or not referencia:
            parser.error("La imagen debe ser nombre=referencia, con nombre simple")
        objetivos.append((nombre, "image", referencia))
    nombres = [o[0] for o in objetivos]
    if len(set(nombres)) != len(nombres):
        raise ValueError("Nombres de objetivos duplicados")
    resumen = {"fecha": dt.datetime.now(dt.timezone.utc).isoformat(), "objetivos": {}}
    bloqueo = False
    for nombre, modo, objetivo in objetivos:
        salida = destino / f"{nombre}.json"
        comando = [args.trivy, modo, "--scanners", "vuln", "--format", "json",
                   "--output", str(salida), "--timeout", "10m", "--no-progress",
                   "--ignorefile", "", "--ignore-unfixed=false",
                   "--severity", "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL",
                   "--list-all-pkgs=true", "--exit-code", "0"]
        if args.cache_dir:
            comando.extend(["--cache-dir", args.cache_dir])
        comando.append(objetivo)
        print(f"Escaneando {nombre}", flush=True)
        with (destino / f"{nombre}.log").open("w", encoding="utf-8") as log:
            subprocess.run(comando, stdout=log, stderr=subprocess.STDOUT, check=True)
        reporte = json.loads(salida.read_text(encoding="utf-8"))
        resultado = evaluar(reporte, excepciones, nombre)
        resumen["objetivos"][nombre] = resultado
        bloqueantes = sum(f["bloquea"] for f in resultado["hallazgos"])
        revisados = sum(bool(f["revision"]) for f in resultado["hallazgos"])
        print(f"{nombre}: {resultado['paquetes']} paquetes, {bloqueantes} altas/criticas "
              f"sin tratamiento, {revisados} hallazgos con revision documentada", flush=True)
        bloqueo = bloqueo or bool(bloqueantes)
        (destino / "resumen.json").write_text(
            json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
    return 1 if bloqueo else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Escaneo incompleto: {error}", file=sys.stderr)
        sys.exit(2)

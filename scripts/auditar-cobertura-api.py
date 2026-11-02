"""Inventario estático de endpoints publicados y contraste con Bruno/evidencia real.

No ejecuta peticiones ni usa secretos. No confunde presencia de un request con
cobertura de criterios: las aserciones se identifican por separado.
"""
import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8-sig')


def normalizar(url):
    url = re.sub(r'^https?://[^/]+', '', url.strip())
    url = re.sub(r'^\{\{[^}]+\}\}', '', url)
    url = url.split('?')[0].rstrip('/') or '/'
    if url.startswith('/api/'):
        url = url[4:]
    return re.sub(r'\{\{[^}]+\}\}', '{param}', url)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--ref', default='HEAD')
    ap.add_argument('--hu-zip', type=Path, required=True)
    ap.add_argument('--evidencia', type=Path, required=True)
    ap.add_argument('--salida', type=Path, required=True)
    args = ap.parse_args()
    commit = git('rev-parse', args.ref).strip()
    archivos = git('ls-tree', '-r', '--name-only', commit).splitlines()
    endpoints = []
    for nombre in archivos:
        if not nombre.startswith('src/main/java/') or not nombre.endswith('Controller.java'):
            continue
        src = git('show', f'{commit}:{nombre}')
        # Esta versión usa anotaciones directas y rutas literales, sin constantes.
        src = re.sub(r'/\*.*?\*/|//[^\n]*', '', src, flags=re.S)
        clase = re.search(r'\bpublic\s+class\s+\w+', src)
        if not clase:
            raise ValueError(f'Controlador no interpretable: {nombre}')
        prefijo = re.search(r'@RequestMapping\s*\((.*?)\)', src[:clase.start()], re.S)
        bases = re.findall(r'"([^"]*)"', prefijo.group(1)) if prefijo else ['']
        if not bases:
            raise ValueError(f'Prefijo no literal: {nombre}')
        for mapping in re.finditer(r'@(Get|Post|Put|Patch|Delete)Mapping\b(?:\s*\((.*?)\))?', src[clase.end():], re.S):
            rutas = re.findall(r'"([^"]*)"', mapping.group(2) or '') or ['']
            for base in bases:
                for ruta in rutas:
                    endpoints.append({'controlador': Path(nombre).stem,
                        'metodo': mapping.group(1).upper(), 'ruta': (base + ruta).rstrip('/') or '/',
                        'fuente': nombre, 'colecciones': [], 'ejecutados': []})
    claves = [(e['metodo'], e['ruta']) for e in endpoints]
    if len(claves) != len(set(claves)):
        raise ValueError('Mappings duplicados; revisar manualmente')

    def resolver(metodo, ruta):
        candidatos = []
        for e in endpoints:
            if e['metodo'] != metodo:
                continue
            patron = re.sub(r'\\\{[^}]+\\\}', '[^/]+', re.escape(e['ruta']))
            if re.fullmatch(patron, ruta):
                candidatos.append(e)
        # Spring prioriza rutas literales sobre variables.
        candidatos.sort(key=lambda e: len(re.sub(r'\{[^}]+\}', '', e['ruta'])), reverse=True)
        if len(candidatos) > 1 and candidatos[0]['ruta'].count('{') == candidatos[1]['ruta'].count('{'):
            raise ValueError(f'Mapping ambiguo: {metodo} {ruta}')
        return candidatos[0] if candidatos else None

    requests = []
    for nombre in archivos:
        if nombre.startswith('bruno-collection/') and nombre.endswith('.bru'):
            requests.append(('repo', nombre, git('show', f'{commit}:{nombre}')))
    with zipfile.ZipFile(args.hu_zip) as z:
        for nombre in z.namelist():
            if nombre.endswith('.bru'):
                requests.append(('HU', nombre, z.read(nombre).decode('utf-8-sig')))
    sin_mapping = []
    inventario = []
    for origen, nombre, src in requests:
        http = re.search(r'^\s*(get|post|put|patch|delete)\s*\{\s*\n\s*url:\s*([^\n]+)', src, re.M | re.I)
        if not http:
            continue  # folder/env no son requests
        metodo, ruta = http.group(1).upper(), normalizar(http.group(2))
        # Sólo status explícitos; no inferir aserciones a partir del nombre del caso.
        estados = sorted(set(map(int, re.findall(r'res\.getStatus\(\)\)[^;\n]{0,70}?\.to\.(?:equal|eq)\((\d{3})\)', src))))
        estados += [int(x) for x in re.findall(r'res\.status:\s*(?:eq\s+)?(\d{3})', src)]
        registro = {'origen': origen, 'archivo': nombre, 'metodo': metodo, 'ruta': ruta,
                    'aserciones': bool(re.search(r'^\s*(tests|assert)\s*\{', src, re.M)),
                    'status_explicitos': sorted(set(estados))}
        inventario.append(registro)
        e = resolver(metodo, ruta)
        if e:
            e['colecciones'].append(registro)
        else:
            sin_mapping.append(registro)
    datos = json.loads(args.evidencia.read_text(encoding='utf-8-sig'))
    resultados = [r for iteracion in datos for r in iteracion['results']]
    def checks(r):
        return [t for campo in ('testResults', 'assertionResults', 'preRequestTestResults', 'postResponseTestResults')
                for t in r.get(campo, [])]

    def estado(r):
        # Bruno status=pass sólo informa que terminó el transporte; considerar tests.
        return 'fail' if r.get('error') or r.get('status') != 'pass' or any(t.get('status') != 'pass' for t in checks(r)) else 'pass'

    evidencia_sin_mapping = []
    for r in resultados:
        metodo, ruta = r['request']['method'], normalizar(r['request']['url'])
        registro = {'archivo': r['test']['filename'], 'statusHTTP': r['response'].get('status'),
                    'resultado': estado(r),
                    'aserciones': [{'descripcion': t.get('description'), 'resultado': t.get('status')}
                                   for t in checks(r)]}
        e = resolver(metodo, ruta)
        if e:
            e['ejecutados'].append(registro)
        else:
            evidencia_sin_mapping.append({'metodo': metodo, 'ruta': ruta, **registro})
    args.salida.mkdir(parents=True, exist_ok=True)
    resumen = {'commit': commit, 'zipSha256': hashlib.sha256(args.hu_zip.read_bytes()).hexdigest(),
        'endpoints': len(endpoints), 'requests_por_coleccion': dict(Counter(r['origen'] for r in inventario)),
        'endpoints_con_request': sum(bool(e['colecciones']) for e in endpoints),
        'endpoints_con_request_repo': sum(any(r['origen'] == 'repo' for r in e['colecciones']) for e in endpoints),
        'endpoints_con_request_HU': sum(any(r['origen'] == 'HU' for r in e['colecciones']) for e in endpoints),
        'endpoints_con_ejecucion_Bruno': sum(bool(e['ejecutados']) for e in endpoints),
        'requests_ejecutados': len(resultados), 'resultado_requests': dict(Counter(estado(r) for r in resultados)),
        'requests_sin_mapping': len(sin_mapping), 'ejecuciones_sin_mapping': len(evidencia_sin_mapping),
        'limites': ['Inventario de controladores Java en el commit; excluye Actuator y handlers del framework.',
                   'Presencia de request/aserción no acredita criterios completos ni cobertura de código.',
                   'Ejecución contrastada: último reporte adaptada-corregida ya obtenido, no una nueva tanda.',
                   'Un endpoint con requests aprobados puede tener otros fallados.',
                   'El detector de status sólo reconoce aserciones literales; inspeccionar los no identificados.']}
    reporte = {'resumen': resumen, 'endpoints': endpoints, 'requests_sin_mapping': sin_mapping,
               'ejecuciones_sin_mapping': evidencia_sin_mapping}
    (args.salida / 'inventario.json').write_text(json.dumps(reporte, ensure_ascii=False, indent=2), encoding='utf-8')
    campos = ['controlador', 'metodo', 'ruta', 'requests_repo', 'requests_HU', 'asercion_2xx',
              'asercion_4xx5xx', 'ejecutados', 'aprobados', 'fallados']
    with (args.salida / 'endpoints.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=campos)
        writer.writeheader()
        for e in endpoints:
            estados = [s for r in e['colecciones'] for s in r['status_explicitos']]
            writer.writerow({**{k: e[k] for k in campos[:3]},
                'requests_repo': sum(r['origen'] == 'repo' for r in e['colecciones']),
                'requests_HU': sum(r['origen'] == 'HU' for r in e['colecciones']),
                'asercion_2xx': any(200 <= s < 300 for s in estados),
                'asercion_4xx5xx': any(400 <= s < 600 for s in estados),
                'ejecutados': len(e['ejecutados']),
                'aprobados': sum(r['resultado'] == 'pass' for r in e['ejecutados']),
                'fallados': sum(r['resultado'] != 'pass' for r in e['ejecutados'])})
    print(json.dumps(resumen, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

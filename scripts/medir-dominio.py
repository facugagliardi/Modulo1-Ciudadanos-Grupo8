"""Resume JaCoCo usando el mismo alcance que el gate Maven y valida su coherencia con PIT."""
import argparse
import fnmatch
import json
from pathlib import Path
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--exigir', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
ns = {'m': 'http://maven.apache.org/POM/4.0.0'}
pom = ET.parse(root / 'pom.xml')
includes = [n.text for n in pom.findall('.//m:execution[m:id="minimos-dominio"]//m:include', ns)]
pit = pom.findtext('.//m:dominio.pit', namespaces=ns).split(',')
report = ET.parse(root / 'target/site/jacoco/jacoco.xml')
classes = []
for node in report.findall('.//class'):
    name = node.attrib['name']
    jacoco_selected = any(fnmatch.fnmatchcase(name + '.class', p) for p in includes)
    pit_selected = any(fnmatch.fnmatchcase(name.replace('/', '.'), p) for p in pit)
    assert jacoco_selected == pit_selected, f'Alcance distinto entre JaCoCo/PIT: {name}'
    if not jacoco_selected:
        continue
    counters = {c.attrib['type']: {k: int(c.attrib[k]) for k in ('missed', 'covered')}
                for c in node.findall('counter')}
    classes.append({'clase': name.replace('/', '.'), 'contadores': counters})
assert classes, 'El alcance no selecciono clases: no acreditar un gate vacio'
totals = {}
for kind in ('LINE', 'BRANCH'):
    covered = sum(c['contadores'][kind]['covered'] for c in classes)
    missed = sum(c['contadores'][kind]['missed'] for c in classes)
    totals[kind] = {'covered': covered, 'missed': missed,
                    'porcentaje': round(100 * covered / (covered + missed), 2)}
result = {'clases': classes, 'totales': totals}
out = root / 'target/dominio-cobertura.json'
out.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(totals, indent=2))
if args.exigir and (totals['LINE']['porcentaje'] < 80 or totals['BRANCH']['porcentaje'] < 70):
    raise SystemExit('No cumple 80% lineas / 70% ramas')

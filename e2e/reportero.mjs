import fs from 'node:fs';
import path from 'node:path';
import { sanear } from './privacidad.mjs';

export default class Reportero {
  casos = [];
  onBegin() { this.inicio = new Date().toISOString(); }
  onTestEnd(test, result) {
    const caso = { caso: test.title, estado: result.status, duracionMs: result.duration,
      errores: result.errors.map(e => sanear(e.message || String(e))) };
    this.casos.push(caso);
    // Sólo PNG; no publicar contextos DOM, trazas, cuerpos HTTP ni sesiones.
    const dir = process.env.E2E_REPORT_DIR || 'reportes';
    fs.mkdirSync(dir, { recursive: true });
    for (const a of result.attachments.filter(a => a.contentType === 'image/png')) {
      const nombre = test.title.match(/^E2E-\d+/)?.[0] || 'fallo';
      const destino = path.join(dir, `${nombre}-${a.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`);
      if (a.path) fs.copyFileSync(a.path, destino);
      else if (a.body) fs.writeFileSync(destino, a.body);
    }
    console.log(`${result.status}: ${test.title}`);
    for (const error of caso.errores) console.log(error);
  }
  onError(error) { console.error(sanear(error.message || String(error))); }
  onEnd(result) {
    const dir = process.env.E2E_REPORT_DIR || 'reportes';
    fs.mkdirSync(dir, { recursive: true });
    const reporte = { inicio: this.inicio, fin: new Date().toISOString(), resultado: result.status,
      baseUrl: process.env.E2E_BASE_URL || 'http://localhost:8090',
      versionAplicacion: process.env.E2E_SOURCE_REF || 'checkout actual',
      navegador: 'Chromium', reintentos: 0, casos: this.casos };
    fs.writeFileSync(path.join(dir, 'resultados.json'), JSON.stringify(reporte, null, 2));
  }
}

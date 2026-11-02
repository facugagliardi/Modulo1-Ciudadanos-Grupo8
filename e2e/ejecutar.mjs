import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanear } from './privacidad.mjs';

const cwd = path.dirname(fileURLToPath(import.meta.url));
process.chdir(cwd);
const args = ['compose'];
if (process.env.E2E_COMPOSE_PROJECT) args.push('-p', process.env.E2E_COMPOSE_PROJECT);
args.push('-f', path.resolve(process.env.E2E_COMPOSE_FILE || '../compose.yaml'),
  'run', '--rm', '-T', 'credenciales');
const fixtures = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 60000 });
if (fixtures.status !== 0) throw Error('No se pudieron leer las cuentas efímeras de Compose.');
// Credenciales sólo en memoria; nunca imprimir stdout de credenciales.
try { process.env.E2E_ACCOUNTS = JSON.stringify(JSON.parse(fixtures.stdout)); }
catch { throw Error('Respuesta de cuentas inválida; contenido omitido.'); }
const inicio = new Date().toISOString();
const result = spawnSync(process.execPath, [path.join(cwd, 'node_modules/@playwright/test/cli.js'),
  'test', ...process.argv.slice(2)], { cwd, env: process.env, encoding: 'utf8',
  windowsHide: true, timeout: 420000, maxBuffer: 12 * 1024 * 1024 });
const dir = path.resolve(process.env.E2E_REPORT_DIR || 'reportes');
fs.mkdirSync(dir, { recursive: true });
const log = sanear((result.stdout || '') + (result.stderr || ''));
fs.writeFileSync(path.join(dir, 'ejecucion.log'), log);
fs.writeFileSync(path.join(dir, 'ejecucion.json'), JSON.stringify({ inicio,
  fin: new Date().toISOString(), exitCode: result.status, error: result.error?.code || null }, null, 2));
console.log(log);
process.exitCode = result.status ?? 1;

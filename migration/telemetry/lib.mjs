// Small shared helpers for the migration telemetry scripts.
// Kept dependency-free (Node built-ins only) so these scripts run with
// nothing but `node`.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Read a JSON Lines file into an array of parsed objects.
 *  Blank lines are skipped. A line that fails to parse is skipped with a
 *  warning on stderr (imports/queries stay tolerant of a half-written or
 *  hand-edited log) unless `strict` is passed. Missing files read as []. */
export function readJsonl(filePath, { strict = false } = {}) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch (err) {
      const msg = `${filePath}:${i + 1}: skipping unparseable JSONL line: ${err.message}`;
      if (strict) throw new Error(msg);
      process.stderr.write(`warning: ${msg}\n`);
    }
  }
  return out;
}

/** Append records (objects) as JSON Lines to filePath, creating dirs as needed. */
export function appendJsonl(filePath, records) {
  if (records.length === 0) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.appendFileSync(filePath, text, 'utf8');
}

export function writeJsonl(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
  fs.writeFileSync(filePath, text, 'utf8');
}

/** Failure signature: sha1(test full title + "\n" + first non-empty line of the error). */
export function failureSignature(fullTitle, errorText) {
  const firstErrorLine = String(errorText || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0) || '';
  const h = crypto.createHash('sha1');
  h.update(String(fullTitle || ''));
  h.update('\n');
  h.update(firstErrorLine);
  return h.digest('hex');
}

export function parseArgs(argv, { flags = [], booleans = [] } = {}) {
  const out = { _: [] };
  for (const b of booleans) out[b] = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (booleans.includes(name)) {
        out[name] = true;
        continue;
      }
      if (flags.length === 0 || flags.includes(name)) {
        out[name] = argv[++i];
        continue;
      }
      throw new Error(`unknown flag: ${arg}`);
    }
    out._.push(arg);
  }
  return out;
}

export function toIso(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return d.toISOString();
}

export const MIGRATION_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
export const TELEMETRY_DIR = path.join(MIGRATION_ROOT, 'telemetry');
export const EVENTS_FILE = path.join(TELEMETRY_DIR, 'events.jsonl');
export const METRICS_FILE = path.join(TELEMETRY_DIR, 'metrics.jsonl');
export const RUNS_DIR = path.join(TELEMETRY_DIR, 'runs');
export const THRESHOLDS_FILE = path.join(TELEMETRY_DIR, 'thresholds.yaml');

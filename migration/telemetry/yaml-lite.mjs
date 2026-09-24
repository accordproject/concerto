// migration/telemetry/yaml-lite.mjs
//
// A tiny, dependency-free YAML reader for exactly the shape thresholds.yaml
// uses: a mapping of mappings of scalars, plus one level of string lists.
// This is NOT a general YAML parser -- it exists so stuck.mjs needs
// nothing but Node's stdlib. If thresholds.yaml ever needs real YAML
// features (anchors, flow style, multiline strings, ...), reach for a
// real parser instead of extending this one.

function stripComment(line) {
  // Whole-line comments only (thresholds.yaml never puts '#' inside a value).
  const idx = line.indexOf('#');
  return idx === -1 ? line : line.slice(0, idx);
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' ) return null;
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return Number.parseFloat(s);
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse a flat two-level YAML mapping (top: {sub: scalar | [scalars]}). */
export function parseYamlLite(text) {
  const lines = text
    .split('\n')
    .map(stripComment)
    .filter((l) => l.trim().length > 0);

  const root = {};
  let currentTop = null;
  let currentSub = null; // {obj, key} when the last line opened a list

  for (const line of lines) {
    const indent = line.match(/^ */)[0].length;
    const content = line.trim();

    if (content.startsWith('- ')) {
      if (currentSub) {
        if (!Array.isArray(currentSub.obj[currentSub.key])) {
          currentSub.obj[currentSub.key] = [];
        }
        currentSub.obj[currentSub.key].push(parseScalar(content.slice(2)));
      }
      continue;
    }

    const colonIdx = content.indexOf(':');
    if (colonIdx === -1) continue;
    const key = content.slice(0, colonIdx).trim();
    const valueRaw = content.slice(colonIdx + 1);
    const value = parseScalar(valueRaw);

    if (indent === 0) {
      root[key] = value === null && valueRaw.trim() === '' ? {} : value;
      currentTop = key;
      currentSub = null;
      if (value === null && valueRaw.trim() === '') {
        root[key] = {};
      }
    } else {
      if (currentTop === null) continue;
      if (typeof root[currentTop] !== 'object' || root[currentTop] === null || Array.isArray(root[currentTop])) {
        root[currentTop] = {};
      }
      if (valueRaw.trim() === '') {
        root[currentTop][key] = [];
        currentSub = { obj: root[currentTop], key };
      } else {
        root[currentTop][key] = value;
        currentSub = null;
      }
    }
  }

  return root;
}

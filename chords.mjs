export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** @param {string} token @param {string} key @param {boolean} bass */
export function degree(token, key, bass = false) {
  const match = /^([1-7])([#b]?)(.*)$/.exec(token);
  if (!match || !KEYS.includes(key)) return token;
  const [, number, accidental, suffix] = match;
  const i = Number(number) - 1;
  const root = KEYS.indexOf(key) + OFFSETS[i] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  const names = key === 'F' || accidental === 'b' ? FLATS : KEYS;
  let quality = QUALITIES[i];
  if (suffix.startsWith('M')) quality = suffix.slice(1);
  else if (/^(m|dim|aug|sus)/.test(suffix)) quality = suffix;
  else quality += suffix;
  return names[(root + 12) % 12] + (bass ? '' : quality);
}

/** @param {string} token @param {string} key */
export function convertChord(token, key) {
  return token.split('/').map((part, index) => degree(part, key, index > 0)).join('/');
}

/** @param {string} content @param {string} key @param {boolean} numeric */
export function transposeText(content, key, numeric = false) {
  return content.replace(/\[([1-7][^\]\n]*)\]/g, (match, token) => numeric ? match : `[${convertChord(token, key)}]`);
}

/** @param {unknown} value */
export function validateCatalog(value) {
  if (!Array.isArray(value) || !value.length) throw new Error('Katalog lagu kosong.');
  for (const song of value) {
    if (!song || !['string', 'number'].includes(typeof song.id) ||
      typeof song.title !== 'string' || typeof song.artist !== 'string' ||
      typeof song.content !== 'string' || !KEYS.includes(song.original_key)) {
      throw new Error('Format katalog lagu tidak valid.');
    }
  }
  return value;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

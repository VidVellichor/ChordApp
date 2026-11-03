import { KEYS, transposeText, validateCatalog, formatTime } from './chords.mjs';
/** @typedef {{id: string|number, title:string, artist:string, original_key:string, content:string}} Song */
/** @type {Song[]} */
let songs = [];
/** @type {Song|null} */
let current = null;
const $ = id => document.getElementById(id);
/** @type {HTMLAudioElement} */
const audio = $('audio');
const sources = new Map();
let session = 'all';
let scrollTimer = 0;
let fontSize = innerWidth <= 620 ? 14 : 16;
let generation = 0;
const mapping = { '1': ['1','2','3','4','5'], '2': ['6','7','8','9','10','11'] };
const say = message => { $('notice').textContent = message; };

for (const key of KEYS) $('key').add(new Option(key, key));
async function loadCatalog() {
  $('retry').hidden = true;
  $('song-list').setAttribute('aria-busy', 'true');
  $('song-list').textContent = 'Memuat pustaka...';
  try {
    const response = await fetch('./songs.json');
    if (!response.ok) throw new Error(`Katalog tidak dapat dimuat (${response.status}).`);
    songs = validateCatalog(await response.json());
    $('song-count').textContent = `${songs.length} lagu`;
    renderLibrary();
    selectSong(songs[0]);
  } catch (error) {
    $('song-list').textContent = error.message || 'Katalog tidak dapat dimuat.';
    $('song-title').textContent = 'Katalog belum tersedia';
    $('chord-display').textContent = 'Periksa koneksi lalu muat ulang katalog.';
    $('retry').hidden = false;
  } finally { $('song-list').setAttribute('aria-busy', 'false'); }
}
function renderLibrary() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const visible = songs.filter(song => (session === 'all' || mapping[session].includes(String(song.id))) && `${song.title} ${song.artist}`.toLocaleLowerCase().includes(query));
  $('song-list').replaceChildren();
  for (const song of visible) {
    const button = document.createElement('button');
    button.className = 'song-item';
    button.setAttribute('aria-current', String(song === current));
    const number = document.createElement('span');
    number.className = 'song-number';
    number.textContent = String(songs.indexOf(song) + 1).padStart(2, '0');
    const label = document.createElement('span'); label.className = 'song-label';
    const title = document.createElement('strong'); title.textContent = song.title;
    const artist = document.createElement('small'); artist.textContent = song.artist;
    label.append(title, artist); button.append(number, label);
    button.onclick = () => selectSong(song);
    $('song-list').append(button);
  }
  if (!visible.length) $('song-list').textContent = 'Tidak ada lagu yang cocok. Coba judul lain.';
}
function stopScroll() {
  clearInterval(scrollTimer); scrollTimer = 0; $('autoscroll').checked = false;
}
function selectSong(song) {
  generation++;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  stopScroll(); current = song;
  $('song-title').textContent = song.title;
  $('song-meta').textContent = `${song.artist} · Nada asli ${song.original_key}`;
  $('key').value = song.original_key;
  for (const id of ['copy','key','down','up','reset','attach','replace']) $(id).disabled = false;
  const source = sources.get(String(song.id));
  if (source) audio.src = source.url;
  $('source-note').textContent = source ? `Rekaman terpasang: ${source.name}. Tersimpan sampai halaman dimuat ulang.` : 'Pilih audio untuk lagu ini. File tetap di perangkat, tidak diunggah.';
  $('player-title').textContent = song.title;
  $('file-name').textContent = source?.name || 'Audio belum dipilih';
  say(''); renderLibrary(); renderChart(); updateMedia();
}
function renderChart() {
  if (!current) return;
  const text = transposeText(current.content, $('key').value, $('numeric').checked);
  const fragment = document.createDocumentFragment();
  for (const line of text.split('\n')) {
    const row = document.createElement('div');
    if (/^\s*\[?(intro|verse\s*\d*|chorus|bridge|reff|tag|outro|coda|ending|instrumental|interlude|penyembahan)\]?:?\s*$/i.test(line)) {
      row.className = 'chart-section'; row.textContent = line;
    } else {
      const pattern = /\[([^\]\n]+)\]/g; let cursor = 0;
      for (const match of line.matchAll(pattern)) {
        row.append(document.createTextNode(line.slice(cursor, match.index)));
        const chord = document.createElement('span'); chord.className = 'chord'; chord.textContent = match[0];
        row.append(chord); cursor = match.index + match[0].length;
      }
      row.append(document.createTextNode(line.slice(cursor) || (line.length ? '' : '\u00a0')));
    }
    fragment.append(row);
  }
  $('chord-display').replaceChildren(fragment);
}
function updateMedia() {
  const hasSource = Boolean(audio.getAttribute('src'));
  const validDuration = Number.isFinite(audio.duration) && audio.duration > 0;
  const playing = hasSource && !audio.paused && !audio.ended;
  $('island').classList.toggle('playing', playing);
  $('play').disabled = !hasSource || Boolean(audio.error);
  $('stop').disabled = !hasSource;
  $('seek').disabled = !validDuration || Boolean(audio.error);
  $('seek').value = validDuration ? audio.currentTime / audio.duration * 100 : 0;
  $('elapsed').textContent = formatTime(audio.currentTime);
  $('duration').textContent = formatTime(audio.duration);
  $('play').setAttribute('aria-label', playing ? 'Jeda audio' : 'Putar audio');
  $('play').querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
  $('player-state').textContent = audio.error ? 'Audio gagal dibaca. Ganti file.' : !hasSource ? 'Pilih rekaman untuk mulai' : playing ? 'Sedang diputar' : audio.ended ? 'Pemutaran selesai' : audio.currentTime > 0 ? 'Dijeda' : 'Siap diputar';
}
async function togglePlay() {
  if (!audio.paused) { audio.pause(); return; }
  const token = generation;
  try { await audio.play(); }
  catch (error) { if (token === generation && error.name !== 'AbortError') say('Audio tidak dapat diputar. Pilih file audio yang didukung browser.'); }
  updateMedia();
}
function expand(value) {
  $('player-details').hidden = !value;
  $('island').classList.toggle('expanded', value);
  for (const id of ['expand','island-expand']) $(id).setAttribute('aria-expanded', String(value));
  $('expand').setAttribute('aria-label', value ? 'Ciutkan pemutar' : 'Perluas pemutar');
}
$('search').oninput = renderLibrary;
document.querySelectorAll('[data-session]').forEach(button => {
  button.onclick = () => {
    session = button.dataset.session;
    document.querySelectorAll('[data-session]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderLibrary();
  };
});
$('retry').onclick = loadCatalog;
$('key').onchange = renderChart; $('numeric').onchange = renderChart;
for (const [id, step] of [['down',-1],['up',1]]) $(id).onclick = () => { $('key').value = KEYS[(KEYS.indexOf($('key').value) + step + 12) % 12]; renderChart(); };
$('reset').onclick = () => { $('key').value = current.original_key; renderChart(); };
for (const [id, step] of [['font-down',-1],['font-up',1]]) $(id).onclick = () => { fontSize = Math.max(12,Math.min(28,fontSize + step)); $('chord-display').style.fontSize = `${fontSize}px`; };
$('copy').onclick = async () => {
  if (!current) return;
  try { await navigator.clipboard.writeText(`${current.title}\n${current.artist} | Nada ${$('key').value}\n\n${transposeText(current.content, $('key').value, $('numeric').checked)}`); say('Chord disalin.'); }
  catch { say('Clipboard tidak tersedia. Pilih dan salin teks chord secara manual.'); }
};
$('autoscroll').onchange = () => {
  if (!$('autoscroll').checked) { stopScroll(); return; }
  scrollTimer = setInterval(() => {
    window.scrollBy(0, Number($('speed').value) * .65);
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) stopScroll();
  }, 50);
};
for (const id of ['attach','replace']) $(id).onclick = () => $('audio-file').click();
$('audio-file').onchange = event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file || !current) return;
  if (file.size === 0 || (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name))) { say('Pilih file audio yang valid dan tidak kosong.'); return; }
  generation++; audio.pause();
  const old = sources.get(String(current.id));
  if (old) URL.revokeObjectURL(old.url);
  const source = { url: URL.createObjectURL(file), name: file.name };
  sources.set(String(current.id), source); audio.src = source.url;
  $('file-name').textContent = file.name;
  $('source-note').textContent = `Rekaman terpasang: ${file.name}. File tetap di perangkat.`;
  say('Audio siap. Tekan putar untuk mulai.'); expand(true); updateMedia();
};
audio.volume = .8;
$('play').onclick = togglePlay;
$('stop').onclick = () => { generation++; audio.pause(); audio.currentTime = 0; updateMedia(); };
$('seek').oninput = () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number($('seek').value) / 100 * audio.duration; };
$('volume').oninput = () => { audio.volume = Number($('volume').value); };
for (const id of ['expand','island-expand']) $(id).onclick = () => expand($('player-details').hidden);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('player-details').hidden) { expand(false); $('expand').focus(); } });
for (const event of ['play','pause','ended','timeupdate','loadedmetadata','durationchange','emptied','error']) audio.addEventListener(event, updateMedia);
audio.addEventListener('error', () => say('File audio tidak dapat dibaca. Pilih rekaman lain dengan format MP3 atau WAV.'));
window.addEventListener('pagehide', () => { stopScroll(); audio.pause(); });
window.addEventListener('unload', () => { for (const source of sources.values()) URL.revokeObjectURL(source.url); });
loadCatalog();

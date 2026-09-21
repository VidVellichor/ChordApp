# Chord Auto-Convert

> Numeric-notation chord transposer for Indonesian worship songs. Songs are written once in **sistem angka** (degree notation: `1`, `4`, `5`, `6`, `2M`, `2/4#`) and rendered live as real chord names for any chosen key, with session-based song grouping.

**Live demo:** https://chord-app-sand.vercel.app
**Stack:** Vanilla JS · Single-file SPA · JSON data store · Vercel

---

## The problem

Worship teams usually keep one arrangement per song in a fixed key. When the singer asks to move it down two semitones, someone rewrites every chord by hand, slowly and with mistakes.

Indonesian church music already has a compact notation for this: scale degrees instead of chord names. `1-5-6-4` means the same progression in every key. This app stores songs in that form and resolves the degrees to actual chords at render time, so transposition is a dropdown change rather than an edit.

## Features

| Feature | Detail |
| --- | --- |
| Degree → chord resolution | `[1] [2] [3] [4] [5] [6] [7]` mapped through a major scale table for all 12 keys |
| Instant transposition | Key selector re-renders the whole chart client-side, no reload |
| Sharp & slash chords | `[4#]` raises the resolved chord a semitone; `[2/4#]` resolves both halves; `2M` supported |
| Session tabs | Song list filtered and ordered per retreat session via `sessionMapping` |
| Song picker | Dropdown of songs in the active session; first entry renders automatically |
| Zero build step | One HTML file, one JSON file, no framework, no bundler |
| Offline-friendly | Static assets only; no API calls in the deployed app |

## How it works

`renderChord()` runs four passes over the raw chart text:

1. **Notation-only toggle**: when on, degrees are kept as numbers and only bolded. Useful for printing a key-agnostic lead sheet.
2. **Degree resolution**: `/[(\d\w\/#]+)]/` matches every token; `scaleKeys[key][n-1]` maps the degree to its chord in the target key.
3. **Accidental & compound tokens**: a trailing `#` raises the resolved root one semitone by walking the note circle (`noteCircle[(idx + 1) % 12]`), and any remaining suffix (`M`, `sus`, `add9`) is appended untouched. Slash chords like `[2/4#]` are split on `/` and each half resolves independently.
4. **Structure highlighting**: section labels (`intro`, `verse`, `chorus`, `bridge`, `reff`, `tag`, `outro`, `coda`, `ending`, `instrumental`, `interlude`, `penyembahan`) are bolded in accent colour, with or without brackets.

```js
// scaleKeys: degree index → chord name, per key
const scaleKeys = {
  C: ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
  G: ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
  // …12 keys total (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
};
```

Because the whole engine is a single regex pass over a string, transposition is instant and fully client-side (nothing is persisted back to `songs.json`.

## Data format

`songs.json` is the entire database:

```json
{
  "id": 1,
  "title": "Song Title",
  "artist": "Artist",
  "original_key": "G",
  "content": "Intro\n[1]  [5]  [6]  [4]\n\nVerse 1\n[6] lyric syllable[1] here\n"
}
```

Chord symbols are embedded inline in `content` as bracketed degrees, positioned where the change falls in the lyric line. Section labels (`Verse`, `Chorus`, `Bridge`, `Intro`, `Outro`) are plain text and pass through untouched.

To add a song: append an object to `songs.json`, then add its `id` to the relevant session array in `sessionMapping` inside `index.html`.

## Running locally

No install needed. Serve the folder statically:

```bash
# any of these work
npx serve .
python -m http.server 8000
```

Then open http://localhost:8000.

## Project structure

```
ChordApp/
├── index.html      # UI + transposition engine (single file)
├── songs.json      # song catalogue (the data store)
└── legacy/
    └── server.js   # early Express + MySQL prototype, not used in the deployed app
```

`legacy/server.js` is kept for reference only. It exposed `/api/songs` against a local XAMPP MySQL instance before the app moved to a static JSON store; the deployed site never calls it.

## Notes on content

The bundled song charts are from an internal retreat collection. If you fork this for public use, replace `songs.json` with material you hold the rights to; the app itself is content-agnostic.

## License

MIT © [David Nehemia](https://github.com/VidVellichor)

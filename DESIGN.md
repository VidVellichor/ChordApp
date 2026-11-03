# ChordApp workspace

Direction: charcoal surfaces with a soft green accent, dark-first music workspace.
Reading: rehearsal workspace for musicians, compact library and readable charts.
ENERGY 2 / RHYTHM 2 / MOTION 2.

- Charcoal separates library and chart; green identifies chords and primary transport.
- Sidebar song list supports quick switching during rehearsal; chart is the focal point.
- System sans keeps controls lightweight; monospace preserves chart spacing.
- Compact toolbar and generous chart line height balance controls and reading.
- Only the floating player uses a capsule and shadow, to distinguish persistent transport.
- SVG transport icons convey real actions; no new logo or generated imagery.
- Player expansion and playback indicator provide state feedback; reduced motion is respected.

## Scope

Preserve catalog, session mapping, numeric notation, copy, font size and auto-scroll.
Support twelve-key transposition, altered degrees, explicit chord qualities and slash bass.
Use local audio files with play/pause, stop, seek, volume and expandable Dynamic Island.
Audio stays on-device and associations last until reload. Chart transposition does not change audio pitch.
No Spotify catalog integration or automatic audio chord recognition.
No deployment, commit, or push in this change.

## Architecture

Retain zero-build static deployment with ES modules and JSDoc typed boundaries.
Separate conversion logic from DOM and audio state. Render catalog as text, not HTML.
Official @shadcn/button and @shadcn/slider registry inspected; native controls avoid adding React/Radix to the existing vanilla app.
Reference: MDN HTMLMediaElement.play and media events.
PRD.md and SPEC.md were absent; acceptance criteria follow the owner's request.

## Acceptance

Search and session filters work with existing songs; errors and empty results are visible.
Local file selection enables real playback. Stop resets position, pause preserves it.
Changing song stops old audio; replacing files revokes old object URLs.
Island reflects media events, supports expansion and Escape collapse.
No mobile overflow; visible keyboard focus; controls at least 44px tall.
Seek is disabled without finite duration; rejected play and invalid media show errors.
Verify locally and report any unverified behavior explicitly.

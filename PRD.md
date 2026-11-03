# Mozzart Studio

Version: 1.0.0
Product owners: David NS & Mozzart

## Product
Hybrid web/local audio workstation for producers, beatmakers, songwriters and content creators. Evolve the existing ChordApp repository without losing rehearsal features or Git history. Local offline processing requires dependencies and model weights installed in advance. Web-hosted processing requires upload to the configured server.

## Confirmed roadmap
1. Link to Sequencer and Upload: public audio URL ingestion, local audio upload, Demucs v4 htdemucs / htdemucs_6s, synchronized stem waveform playback, mute/solo, downloads.
2. Beat Machine and Lush Chord Builder: genre patterns, offline DSP preview without VST, multitrack SMF Type-1 MIDI at 480 PPQ, Drop-2 voicing, Euclidean arpeggiator.
3. Mastering: stem summing, vocal tuning, loudness and dynamic-range reporting, ITU-R BS.1770-4 measurement and measured export true peak.
4. Lyric Lab and Suno Prompt Crafter: rhyme and syllable analysis, prompt composition, integration tests, scratch retention and CPU/GPU benchmarking.

## Original ChordApp requirements retained
Recognize timestamped chords from full-band songs, highlight the chord at the playhead, render guitar fingering diagrams from validated data and allow corrections. Diagram is guitar, not piano. A G-major reference has low E fret 3 finger 2, A fret 2 finger 1, high E fret 3 finger 3, remaining strings open. Audio chord recognition must be evaluated separately; stem separation is not chord recognition.

## Milestone delivery boundaries
SPEC.md records the executable Milestone 1 upload-first slice. Seven module destinations may identify future work but must not present fake analysis or simulated exports. URL ingestion needs SSRF protection, size/duration bounds and source policy before activation. Preserve existing static application at repository root during migration.

## Incomplete source detail
This is a condensed record of confirmed requirements from discussion, not a claim that the original full specification has been recovered. Fine-grained requirements for future modules and model training remain to be confirmed. No additional training, dataset collection, model quality claims or hosted deployment are implied by this milestone.

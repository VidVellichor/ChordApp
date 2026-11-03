"""Experimental chroma-template analysis; no learned model or downloads."""
from pathlib import Path
import wave

import numpy as np
from pydantic import BaseModel, Field


class ChordSegment(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    chord: str
    confidence: float = Field(ge=0, le=1)


class ChordAnalysis(BaseModel):
    duration: float = Field(gt=0)
    method: str = 'experimental-fft-chroma-triads-v1'
    limitations: list[str] = [
        'Experimental, not evaluated on full-band songs; drums, vocals and harmonics can cause wrong labels.',
        'Only major/minor triads and N (silence or ambiguous audio); no inversions, sevenths or tuning correction.',
        'Half-second analysis grid; confidence is template similarity, not calibrated probability.',
    ]
    segments: list[ChordSegment]


def analyze_chords(path: Path) -> ChordAnalysis:
    with wave.open(str(path), 'rb') as audio:
        duration = audio.getnframes() / audio.getframerate()
        samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2')
        mono = samples.reshape(-1, audio.getnchannels()).mean(axis=1)[::4] / 32768
        rate = audio.getframerate() / 4
    names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    templates, labels = [], []
    for root, name in enumerate(names):
        for third, suffix in ((4, ''), (3, 'm')):
            template = np.zeros(12)
            template[[(root + interval) % 12 for interval in (0, third, 7)]] = 1 / np.sqrt(3)
            templates.append(template)
            labels.append(name + suffix)
    templates = np.array(templates)
    frequencies = np.fft.rfftfreq(16384, 1 / rate)
    selected = (frequencies >= 65) & (frequencies <= 2100)
    pitch = np.rint(69 + 12 * np.log2(frequencies[selected] / 440)).astype(int) % 12
    segments = []
    for index in range(int(np.ceil(duration / 0.5))):
        offset = round(index * rate * 0.5)
        frame = mono[offset:round((index + 1) * rate * 0.5)]
        chord, confidence = 'N', 0.0
        if np.sqrt(np.mean(frame ** 2)) > 0.005:
            spectrum = np.abs(np.fft.rfft(frame * np.hanning(len(frame)), n=16384))[selected]
            chroma = np.bincount(pitch, weights=spectrum, minlength=12)
            norm = np.linalg.norm(chroma)
            scores = templates @ (chroma / max(norm, 1e-12))
            best = int(np.argmax(scores))
            confidence = float(np.clip(scores[best], 0, 1))
            if confidence >= 0.75 and confidence - np.partition(scores, -2)[-2] >= 0.08:
                chord = labels[best]
        start, end = offset / rate, min((offset + len(frame)) / rate, duration)
        if segments and segments[-1].chord == chord:
            previous = segments[-1]
            previous.confidence = (previous.confidence * (previous.end - previous.start) + confidence * (end - start)) / (end - previous.start)
            previous.end = end
        else:
            segments.append(ChordSegment(start=start, end=end, chord=chord, confidence=confidence))
    return ChordAnalysis(duration=duration, segments=segments)

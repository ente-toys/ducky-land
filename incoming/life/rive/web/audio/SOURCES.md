# Sound sources

All four sounds are original procedural synthesis by Codex for this project, generated locally by `../../synth_sfx.py`. No recordings, external samples, paid services, or third-party assets were used. No attribution is required for these synthesized assets.

- `quack.wav`: 330 ms, nasal harmonic chirp with two breath envelopes.
- `pop.wav`: 160 ms, falling-pitch damped sine.
- `splash.wav`: 370 ms, deterministic filtered noise and a pitched water transient.
- `step.wav`: 95 ms, low sine contact and filtered-noise tap.

Mono 24 kHz, 16-bit PCM. The page plays them through Web Audio after a keyboard or pointer gesture. M toggles sound. Volume is intentionally quiet, footsteps quieter still. The synthesis source is deterministic and uses Python's standard library.

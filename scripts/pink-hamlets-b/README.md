Teacup Quay and Tutu Tides source import

These source scripts came from c4640f0e and are now replayed by scripts/bigger-pink/build.mjs after the fixed shore and inland hamlets. apply.py preserves the approved kit scale and translates the whole Teacup composition to [6700,4740]. refine.py packages the original decorative courts and workshop tools, retaining the short south-facing quay dock.

Final source consolidation, collision cleanup, centre-style path paint, approved sleeper resolution and the quay boat are handled in scripts/pink-final. Use the production build entry rather than replaying this folder independently. ground.py and static.mjs are historical branch tools and are not part of the integrated pipeline.

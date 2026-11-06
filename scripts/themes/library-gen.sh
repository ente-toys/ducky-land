#!/bin/bash
# Library island hero pieces: one GPT image per call through the Codex CLI (same exec form as concepts/themes/concepts/gen-one.sh).
# usage: scripts/themes/library-gen.sh <id> "<what to draw>"
D="/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/library-gen"
C="/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/concepts/03-library.png"
CODEX=$(find /Applications/ChatGPT.app/Contents/Resources -maxdepth 4 -name codex -type f -perm -u+x 2>/dev/null | head -1)
id="$1"; desc="$2"
cp "$C" "$D/concept.png" 2>/dev/null
P="home-props-ref.png shows the EXACT art style of our game Ducky Land: flat vector cartoon game props, clean flat colour fills, ONE darker shade band on the lower-right side and ONE soft cream highlight on the upper-left, uniform dark green-black ink outlines (#39472D) about 3px thick, no gradients, no texture, no noise, no drop shadow. Palette: grass #89C332, leaf #4AA539, deep leaf #2B7A37, sand #FDE48C, wood #C88941, dark wood #885931, cream #FFF0C7, coral #F16E4B, sun #FFB937, water #6EC9DE, plus book-cover colours red #E0533F, blue #3F7FC9, green #58A845, mustard #F2B33D, purple #8A63C9. concept.png is the approved concept for our LIBRARY island (an island shaped like an open book). Draw, in the home-props-ref style (NOT the painterly concept style), and in the same high 3/4 top-down oblique game camera: $desc Isolated on a PLAIN PURE WHITE background, no ground, no grass, no shadow on the ground, no text, no letters, no labels, no Duckies, nothing touching the image edges, generous white margin."
"$CODEX" exec -C "$D" -s workspace-write --skip-git-repo-check -c model_reasoning_effort=low -i "$D/home-props-ref.png" -i "$D/concept.png" -- "Use the imagegen skill, built-in image_gen tool, with home-props-ref.png as the style reference and concept.png as the subject reference. Generate ONE image. $P Save it in the current working directory as $id.png. Reply with only the absolute path." < /dev/null > "$D/log-$id.txt" 2>&1
[ -f "$D/$id.png" ] || { f=$(ls -t ~/.codex/generated_images/*/*.png 2>/dev/null | head -1); echo "missing $id (latest gen $f)" >> "$D/missing.txt"; }

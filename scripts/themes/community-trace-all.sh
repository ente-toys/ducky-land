#!/bin/bash
# Vectorise every community prop sheet (concepts/themes/community-gen/sheet-*.png) into public/pixi-art/themes/community/detail/.
# PY = a python3.11 with vtracer cairosvg pillow numpy scipy
PY=${PY:-python3.11}; G="$(cd "$(dirname "$0")/../../.." && pwd)/concepts/themes/community-gen"; T="$(dirname "$0")/community-trace.py"
while read -r sheet a b c d; do [ -f "$G/$sheet.png" ] && "$PY" "$T" "$G/$sheet.png" $a $b $c $d; done <<'L'
sheet-a notice-board campfire log-seat lights-span
sheet-b stage pavilion member-wall bubble-sculpture
sheet-c tree-wisteria tree-lilac cushions game-table
sheet-d lamp-typing boost-crystal emoji-sign badge-buoy
sheet-e canopy-sofa lavender-stall sofa speaker
sheet-f bush-lavender flowers-purple bench-lavender signpost
sheet-g parasol lounger picnic-blanket cocoa-cart
sheet-h gazebo-crystal play-frame swing-set mic-voice
L

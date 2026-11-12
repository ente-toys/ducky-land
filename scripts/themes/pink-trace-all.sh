#!/bin/bash
PY=${PY:-python3.11}; G="$(cd "$(dirname "$0")/../../.." && pwd)/concepts/themes/pink-gen"; T="$(dirname "$0")/pink-trace.py"
while read -r sheet a b c d; do [ -f "$G/$sheet.png" ] && "$PY" "$T" "$G/$sheet.png" $a $b $c $d; done <<'L'
sheet-a dollhouse-pink dollhouse-lilac cottage-pink teacup-cafe
sheet-b ribbon-plinth gazebo heart-arch heart-hedge
sheet-c bow-bench parasol tree-cherry tree-willow
sheet-d play-tower swing-set candy-cart pink-car
sheet-e lamp-heart bush-pink lounger flowers-pink
sheet-f picnic-blanket sandcastle-pink mailbox swim-ring
L

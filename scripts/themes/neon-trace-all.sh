#!/bin/bash
PY=${PY:-python3.11}; G="$(cd "$(dirname "$0")/../../.." && pwd)/concepts/themes/neon-gen"; T="$(dirname "$0")/neon-trace.py"
"$PY" "$T" "$G/shops1.png" shop-noodle,shop-boba,shop-cat thin=1
"$PY" "$T" "$G/shops2.png" shop-arcade,shop-cupcake,shop-star thin=1
"$PY" "$T" "$G/street1.png" noodle-kiosk,vending-pink,vending-mint,capsule-seat thin=1
"$PY" "$T" "$G/street2.png" neon-lamp,lantern-arch,sign-board,planter-box thin=1
"$PY" "$T" "$G/tower.png" clock-tower thin=1 dil=15

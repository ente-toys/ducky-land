# Multiplayer simulation rollout

Publish the room Worker and its additive migration before publishing Pages with the new class bindings. The compatible Worker continues serving the legacy Pages build. Once both versions are available, the first protocol-v2 connection requests the layout configured for that Pages environment. The production configuration in this change requests the split. Merging is the production cutover decision.

The existing world object's name remains its storage identity. Each simulation key also contains that world name. Automatic Pages previews use the deployed legacy class with the separate `preview-island` world. The production Pages bindings target the new classes after the Worker migration. The top-level Worker exposes no public migration endpoint.

## Baseline

During the November 18 stress test, Sentry recorded a 5.35-second tick gap with 106 connections in the shared room. [Incident logs](https://aswinasok.sentry.io/explore/logs/?logsQuery=operation%3Atick_gap&start=2026-11-18T10%3A40%3A00&end=2026-11-18T10%3A50%3A00)

At deployed commit `d76854ff`, the existing Home harness measured 34.12 MiB/s of full snapshots for 100 players over 20 seconds. A separate 30-second local workerd run joined 250 players in bursts, kept 100 walkers on Home, and exercised sailing, friends, and the globe. Its p99 active tick gap was 57 ms, its maximum was 58 ms, and p95 join-to-first-snapshot was 28 ms. Both observers stayed connected. The multi-second production gap did not recur locally.

## Before merging

Run the project build and tests, the two Wrangler bundle checks, and the local Workers load harness. The harness creates its own Miniflare runtime. It runs three 30-minute trials by default.

```sh
npm ci
npm run build
npm test
npx wrangler deploy --dry-run --config worker/wrangler.jsonc --outdir=/tmp/ducky-room-check
npx wrangler pages functions build functions --outdir=/tmp/ducky-pages-check --compatibility-date=2026-11-02 --compatibility-flag=nodejs_compat
node scripts/check-simulation-bundles.mjs /tmp/ducky-pages-check/index.js /tmp/ducky-room-check/cloudflare.js
node scripts/load-simulations.mjs
```

Start the existing realtime fixture with `node server.mjs` for the network tests. Set the same `DUCKY_WS_PORT` for the fixture and the test process when using a non-default port. For a short functional check of the load runner, pass a duration in seconds and a repetition count.

Review each trial's actor count, transfers, observer closes, join p95, per-owner p99 and maximum tick gap, and shutdown timestamp. The local pass measures behavior in workerd. Match production Sentry's Worker version to the GitHub deployment check when checking live behavior.

## Diagnosing snapshot delivery

Load-test players can request `room-timing` on their WebSocket. Responses identify the simulation owner, room epoch, Worker version, current tick, and outstanding snapshot acknowledgments. Their snapshots also carry a Worker timestamp for ten seconds after a probe. Compare Worker frame spacing with client arrival spacing and local event-loop delay. The launcher records round-trip times to the room and HTTP timings for the Cloudflare-managed `/cdn-cgi/trace` and app `/api/session` routes.

To compare delivery from a separate network, run `node scripts/probe-edge.mjs` there while the load test runs. Compare UTC timestamps and `edgeColo` for the two observers. A slow launcher-only control is evidence for its path when the independent observer reaches the same colo. Slow controls from both networks can indicate a shared edge problem. These checks cannot fully separate an edge WebSocket issue from a WebSocket-specific path issue without matching platform telemetry.

## During cutover

The private world object journals the migration ID, pauses gameplay, checkpoints live state, and closes legacy sockets. Older tabs need a refresh. Each island imports its players, boats and Bog records, and the sea imports occupied boats and sailors. The world verifies the imported records before opening the new layout. Sessions, social data, currency balances and global feather inventory stay in the original object. A retry with the same migration ID resumes the migration.

The bindings are additive. Keep the new classes and their namespaces through the rollback window. Monitor room tick gaps, socket closes, transfers, join failures and client reconnect reasons. In particular, check a quiet island while Home is busy. Independent observer close times can be compared to the runner shutdown timestamp.

## Rollback

Keep the compatible Worker deployed. Set the production Pages variables `WORLD_LAYOUT=legacy` and `WORLD_MIGRATION_ID` to a **new** identifier, then publish that configuration. A compatible join starts the reverse cutover. The world stops admissions, freezes the simulations, reconciles actors and occupied boats, restores the legacy gameplay tables, and reopens. If a forward import stopped before reopening, this path restores the saved source checkpoint. To retry an interrupted migration in the same direction, retain its ID.

Rolling back the Worker binary alone could start the old simulation against stale data. Complete the reverse migration and verify a walking player, a sailing player and a quiet observer before retiring the split code.

## Repair the public boat fleet

For a world already using split simulations, set the Pages variables `WORLD_LAYOUT=split`, `WORLD_REPAIR_FLEET=1`, and `WORLD_MIGRATION_ID` to a new identifier. A compatible join temporarily pauses admissions and repairs the persisted fleet across all islands and the sea. The repair keeps one public boat per original berth, including boats away from home, and restores missing boats where there is a safe position near their original mooring. It preserves player-built boats and defers removal of any occupied surplus boat until it has been unattended for six hours. Use the same ID to retry an interrupted repair. After the repair completes, clear `WORLD_REPAIR_FLEET`.

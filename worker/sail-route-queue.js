import {applySailPlan, canStartSailPlan, landingApproachSteps, near, planSailDestinationSteps} from '../src/gameplay/islands.js';
import {mapsVersion} from '../src/world/island-maps.js';

// Use work units because Workers' clocks do not advance during synchronous computation.
export const SAIL_ROUTE_WORK_PER_TICK = 10_000;
const MAX_ACTIVE_ROUTES = 4;
const WORK_PER_TURN = 2500;

function* plan(job, boats) {
  const {origin, x, y, landing, work} = job;
  const approach = landing && (yield* landingApproachSteps(origin, landing, boats, work));
  const destination = approach || {x, y};
  if (approach && near(origin, approach, 14)) return {approach, route: null};
  const route = yield* planSailDestinationSteps(origin, destination.x, destination.y, boats, work);
  return {approach, route};
}

export class SailRouteQueue {
  pending = new Map();
  active = new Map();

  get size() { return this.pending.size; }

  has(actor) {
    return Boolean(actor && this.pending.get(actor.boatId)?.actor === actor);
  }

  cancel(actor) {
    if (!this.has(actor)) return;
    this.pending.delete(actor.boatId);
    this.active.delete(actor.boatId);
  }

  clear() {
    this.pending.clear();
    this.active.clear();
  }

  request(socket, info, x, y, reason, now, landing = null) {
    const {actor} = info;
    const {boatId, islandId} = actor;
    if (!boatId) return false;
    const previous = this.pending.get(boatId);
    if (previous?.actor === actor) {
      // A collision on the previous path must not replace a pending player request.
      if (reason === 'reroute') return true;
      if (reason === previous.reason && x === previous.x && y === previous.y &&
          landing?.islandId === previous.landing?.islandId &&
          landing?.islet === previous.landing?.islet && landing?.jetty === previous.landing?.jetty)
        return true;
    }
    this.active.delete(boatId);
    this.pending.set(boatId, {
      socket, info, actor, boatId, islandId, x, y, reason, landing, requestedAt: now,
      docking: reason === 'reroute' && actor.docking,
    });
    return true;
  }

  step(room, now, health, budget = SAIL_ROUTE_WORK_PER_TICK) {
    let remaining = budget;
    let skipped = 0;
    while (remaining > 0 && this.size) {
      // Keep a small number of searches in progress so a cold chart or crowded
      // dock cannot block cheaper requests, while bounding retained search state.
      for (const job of this.pending.values()) {
        if (this.active.size >= MAX_ACTIVE_ROUTES) break;
        if (!this.active.has(job.boatId)) this.active.set(job.boatId, job);
      }
      const job = this.active.values().next().value;
      const {actor, boatId, info, socket, islandId} = job;
      this.active.delete(boatId);
      if (room.connections.get(socket) !== info || info.actor !== actor || actor.mode !== 'sailing' ||
          actor.boatId !== boatId || actor.islandId !== islandId) {
        this.pending.delete(boatId);
        remaining--;
        continue;
      }
      if (!job.steps || job.mapsVersion !== mapsVersion()) {
        job.mapsVersion = mapsVersion();
        job.origin = {x: actor.x, y: actor.y, islandId, boatId};
        job.work = {};
        job.steps = plan(job, room.boats.map((boat) => ({...boat})));
        job.nextCost = 1;
        health.routeQueueWait = Math.max(health.routeQueueWait, now - job.requestedAt);
        health.work[job.reason === 'reroute' ? 'route_reroute' : 'route_plan']++;
      }
      if (job.nextCost > remaining) {
        this.active.set(boatId, job);
        if (++skipped >= this.active.size) break;
        continue;
      }
      skipped = 0;
      let turn = Math.min(remaining, Math.max(WORK_PER_TURN, job.nextCost));
      let done = false;
      while (job.nextCost <= turn) {
        turn -= job.nextCost;
        remaining -= job.nextCost;
        const next = job.steps.next();
        if (next.done) {
          this.pending.delete(boatId);
          this.apply(room, job, next.value, now, health);
          done = true;
          break;
        }
        job.nextCost = next.value;
      }
      if (!done) {
        this.active.set(boatId, job);
      }
    }
    health.routeWorkUnits += budget - remaining;
  }

  apply(room, job, {route, approach}, now, health) {
    const {actor, info, reason, landing, work} = job;
    health.routeFineVisits += work.fineVisits ?? 0;
    health.routeAlternatives += work.alternatives ?? 0;
    health.routeLatency = Math.max(health.routeLatency, now - job.requestedAt);
    if (route && !canStartSailPlan(actor, route, room.boats)) {
      // Boats and the requester may have moved since planning started.
      if (!job.retried) {
        const retry = {...job, steps: null, retried: true};
        this.pending.delete(job.boatId);
        this.pending.set(job.boatId, retry);
        return;
      }
      route = null;
    }
    if (route) applySailPlan(actor, route);
    else if (!approach || !near(job.origin, approach, 14)) health.routeFailures++;

    if (landing) {
      info.landing = {...landing, approach: route ? approach : {x: actor.x, y: actor.y}};
    } else if (reason === 'dock') {
      actor.docking = Boolean(route);
      actor.dockTarget = route?.target ?? null;
    } else if (reason === 'reroute') {
      actor.docking = Boolean(route && job.docking);
    }
  }
}

import {env} from 'cloudflare:workers';
import {instrumentDurableObjectWithSentry, logger} from '@sentry/cloudflare';
import {sentryOptions} from '../server/sentry.js';
import {WorldService as Room} from './world-service.js';
export {IslandSimulation, SeaSimulation} from './simulation.js';
export {WorldPresence} from './world-presence.js';

const routes = new Set([
  '/room', '/bog-room', '/friends', '/outfit', '/stars', '/stars/count', '/flow', '/consume',
  '/session/new', '/session/access', '/session/get', '/session/revoke',
]);

const slowMs = {tick: 50, tick_gap: 150, checkpoint: 25, checkpoint_sync: 250};
const reportIntervalMs = 60_000;

function roomLog(level, message, attributes) {
  // Timer callbacks may outlive the SDK invocation scope. Native logging also
  // keeps an exportable record when that scope cannot flush the SDK log.
  try { console[level](message, attributes); } catch {}
  try { logger[level](message, attributes); } catch {}
}

class MonitoredRoom extends Room {
  constructor(ctx, bindings) {
    const started = performance.now();
    const identity = {object_id: ctx.id.toString(), worker_version: bindings?.CF_VERSION_METADATA?.id};
    try {
      super(ctx, bindings);
    } catch (error) {
      roomLog('error', 'Room operation failed', {...identity, operation: 'initialize', duration_ms: performance.now() - started});
      throw error;
    }
    this.diagnostics = {...identity, room_epoch: this.epoch};
    this.health = {};
    this.nextHealthReport = Date.now() + reportIntervalMs;
    this.nextCheckpointSample = 0;
    this.reportOperation('info', 'Room initialized', 'initialize', started);
  }

  reportOperation(level, message, operation, started, fields = {}) {
    roomLog(level, message, {
      ...this.diagnostics, operation, duration_ms: performance.now() - started,
      connections: this.connections.size, last_checkpoint_ms: this.lastCheckpointMs,
      last_confirmed_checkpoint_ms: this.lastConfirmedCheckpointMs, ...fields,
    });
  }

  measure(operation, run) {
    // The base constructor can checkpoint while restoring the room.
    if (!this.diagnostics) return run();
    const started = performance.now();
    try {
      const result = run();
      if (operation === 'checkpoint' && !result) return result;
      if (operation === 'checkpoint') this.lastCheckpointMs = Date.now();
      this.recordTiming(operation, performance.now() - started);
      return result;
    } catch (error) {
      this.reportOperation('error', 'Room operation failed', operation, started);
      throw error;
    }
  }

  recordTiming(operation, duration) {
    const timings = this.health[operation] ??= {count: 0, sum: 0, max: 0, slow: 0};
    timings.count++;
    timings.sum += duration;
    timings.max = Math.max(timings.max, duration);
    if (duration >= slowMs[operation] && ++timings.slow === 1) {
      roomLog('warn', 'Room operation slow', {
        ...this.diagnostics, operation, duration_ms: duration,
        connections: this.connections.size, last_checkpoint_ms: this.lastCheckpointMs,
      });
    }
  }

  step() {
    const now = performance.now();
    if (this.previousTick !== undefined) this.recordTiming('tick_gap', now - this.previousTick);
    const result = this.measure('tick', () => super.step());
    this.previousTick = this.timer ? now : undefined;
    this.reportHealth();
    return result;
  }

  saveBoats(...args) {
    const written = this.measure('checkpoint', () => super.saveBoats(...args));
    if (written && this.diagnostics && Date.now() >= this.nextCheckpointSample) {
      this.nextCheckpointSample = Date.now() + reportIntervalMs;
      this.ctx.waitUntil(this.sampleCheckpointCommit());
    }
    return written;
  }

  async sampleCheckpointCommit() {
    const started = performance.now();
    try {
      await this.ctx.storage.sync();
      this.lastConfirmedCheckpointMs = Date.now();
      this.recordTiming('checkpoint_sync', performance.now() - started);
    } catch (error) {
      this.reportOperation('error', 'Room operation failed', 'checkpoint_sync', started);
    }
  }

  reportHealth() {
    const now = Date.now();
    if (now < this.nextHealthReport) return;
    this.nextHealthReport = now + reportIntervalMs;
    for (const [operation, {count, sum, max, slow}] of Object.entries(this.health)) {
      roomLog('info', 'Room operation timings', {
        ...this.diagnostics, operation, connections: this.connections.size,
        count, mean_ms: sum / count, max_ms: max, slow_count: slow, last_checkpoint_ms: this.lastCheckpointMs,
        last_confirmed_checkpoint_ms: this.lastConfirmedCheckpointMs,
      });
    }
    this.health = {};
  }

  async scheduleExpiry() {
    const started = performance.now();
    try {
      return await super.scheduleExpiry();
    } catch (error) {
      this.reportOperation('error', 'Room operation failed', 'alarm_schedule', started);
      throw error;
    }
  }

  async alarm() {
    const started = performance.now();
    try {
      return await super.alarm();
    } catch (error) {
      this.reportOperation('error', 'Room operation failed', 'alarm', started);
      throw error;
    }
  }

  logCounts() {
    let players = 0;
    for (const info of this.connections.values()) if (info.actor) players++;
    return {connections: this.connections.size, players, watchers: this.connections.size - players};
  }

  reportSocketRejection(reason, code) {
    roomLog('warn', 'Room socket rejected', {
      ...this.diagnostics, rejection_reason: reason, close_code: code, connections: this.connections.size,
    });
  }

  async fetch(request) {
    const route = new URL(request.url).pathname;
    const started = Date.now();
    try {
      const response = await super.fetch(request);
      logger[response.status >= 500 ? 'error' : 'info']('Room request completed', {
        route, status: response.status, duration_ms: Date.now() - started, ...this.logCounts(),
      });
      return response;
    } catch (error) {
      logger.error('Room request failed', {route, duration_ms: Date.now() - started, ...this.logCounts()});
      throw error;
    }
  }

  webSocketClose(socket, code, reason, wasClean) {
    logger[code === 1000 || code === 1001 ? 'info' : 'warn']('Room socket closed', {
      ...this.diagnostics, close_code: code, was_clean: wasClean, ...this.logCounts(),
    });
    const started = performance.now();
    try {
      return super.webSocketClose(socket, code, reason, wasClean);
    } catch (error) {
      this.reportOperation('error', 'Room operation failed', 'socket_close', started, {close_code: code, was_clean: wasClean});
      throw error;
    }
  }

  webSocketError(socket, error) {
    const started = performance.now();
    this.reportOperation('error', 'Room socket error', 'socket_error', started);
    try {
      return super.webSocketError(socket, error);
    } catch (failure) {
      this.reportOperation('error', 'Room operation failed', 'socket_error', started);
      throw failure;
    }
  }
}

export const IslandRoom = env.SENTRY_DSN
  ? instrumentDurableObjectWithSentry(bindings => sentryOptions(bindings, 'room', routes), MonitoredRoom)
  : MonitoredRoom;

export {default} from './index.js';

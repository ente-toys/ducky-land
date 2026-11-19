import {captureException, getIsolationScope, logger, sentryPagesPlugin} from '@sentry/cloudflare';
import {isRoomUpgradeRoute} from '../server/room-upgrade.js';
import {roomBindingFlags, roomUpgradeFailureReason, sentryOptions} from '../server/sentry.js';

const routes = new Set([
  '/api/friends', '/api/outfit', '/api/play-access', '/api/room', '/api/session', '/api/stars',
  '/arena-room', '/auth/github/callback', '/auth/github/start', '/auth/logout',
]);

const monitorRequest = sentryPagesPlugin(({env}) => sentryOptions(env, 'pages', routes));

export const onRequest = [
  context => context.env.SENTRY_DSN ? monitorRequest(context) : context.next(),
  async context => {
    const route = new URL(context.request.url).pathname;
    if (!context.env.SENTRY_DSN || !routes.has(route)) return context.next();
    const started = Date.now();
    const data = context.data;
    if (data && (route === '/api/room' || route === '/arena-room') &&
        context.request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      data.roomUpgradeRequestId = crypto.randomUUID();
    }
    let response;
    try {
      response = await context.next();
    } catch (error) {
      const failure = data?.roomBindingFailure;
      const binding = failure && failure.error === error;
      const duration_ms = Date.now() - started;
      const upgrade = binding && isRoomUpgradeRoute(failure.route) && data.roomUpgradeRequestId && {
        room_upgrade_request_id: data.roomUpgradeRequestId, room_upgrade_reason: roomUpgradeFailureReason(error),
      };
      if (upgrade) {
        const scope = getIsolationScope();
        scope.setTags({route, room_binding_route: failure.route, ...upgrade});
        scope.setExtra('duration_ms', duration_ms);
      }
      logger.error('Pages request failed', {route, duration_ms,
        ray_id: context.request.headers.get('CF-Ray'),
        ...(binding && {room_binding_route: failure.route, ...roomBindingFlags(error)}),
        ...upgrade,
      });
      throw error;
    }
    const duration_ms = Date.now() - started;
    const upgrade = data?.roomUpgradeStatus === response.status && {
      room_upgrade_request_id: data.roomUpgradeRequestId,
      ...(response.status >= 500 && {room_upgrade_reason: 'upstream_5xx'}),
    };
    logger[response.status >= 500 ? 'error' : 'info']('Pages request completed', {
      route, status: response.status, duration_ms, ...upgrade,
    });
    if (response.status >= 500) {
      const error = new Error('Pages returned a server error');
      error.name = 'PagesResponseError';
      captureException(error, {tags: {route, status: response.status, ...upgrade}, extra: {duration_ms}});
    }
    return response;
  },
];

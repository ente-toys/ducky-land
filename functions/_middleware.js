import {captureException, logger, sentryPagesPlugin} from '@sentry/cloudflare';
import {sentryOptions} from '../server/sentry.js';

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
    let response;
    try {
      response = await context.next();
    } catch (error) {
      logger.error('Pages request failed', {route, duration_ms: Date.now() - started,
        ray_id: context.request.headers.get('CF-Ray')});
      throw error;
    }
    logger[response.status >= 500 ? 'error' : 'info']('Pages request completed', {
      route, status: response.status, duration_ms: Date.now() - started,
    });
    if (response.status >= 500) {
      const error = new Error('Pages returned a server error');
      error.name = 'PagesResponseError';
      captureException(error, {tags: {route, status: response.status}});
    }
    return response;
  },
];

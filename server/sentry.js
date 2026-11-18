import {httpServerIntegration} from '@sentry/cloudflare';

const errorTypes = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'PagesResponseError',
]);
const spanAttributes = ['sentry.op', 'sentry.origin', 'http.request.method', 'http.response.status_code', 'app.route'];
const logMessages = new Set(['Pages request completed', 'Pages request failed', 'Room request completed', 'Room request failed', 'Room socket closed', 'Room socket error',
  'Room binding failed', 'Room socket rejected', 'Room initialized', 'Room operation failed', 'Room operation slow', 'Room operation timings']);
const roomBindingRoutes = new Set(['/room', '/bog-room', '/consume', '/flow', '/friends', '/outfit',
  '/session/access', '/session/get', '/session/new', '/session/revoke', '/stars', '/stars/count']);
const roomFailureFlags = ['overloaded', 'retryable', 'remote'];
const socketRejectionReasons = new Set(['rate_limit', 'non_text_message', 'message_too_large']);
const logNumbers = ['status', 'duration_ms', 'connections', 'players', 'watchers', 'close_code',
  'count', 'mean_ms', 'max_ms', 'slow_count', 'last_checkpoint_ms', 'last_confirmed_checkpoint_ms'];
const roomOperations = new Set(['initialize', 'tick', 'tick_gap', 'checkpoint', 'checkpoint_sync', 'alarm', 'alarm_schedule', 'socket_close', 'socket_error']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const logMetadata = ['sentry.sdk.name', 'sentry.sdk.version', 'sentry.trace.parent_span_id'];

export function roomBindingFlags(error) {
  return Object.fromEntries(roomFailureFlags.filter(key => typeof error?.[key] === 'boolean')
    .map(key => [key, error[key]]));
}

function scrubException({type, mechanism, stacktrace}) {
  return {
    type: errorTypes.has(type) ? type : 'Error',
    value: type === 'PagesResponseError' ? 'Pages returned a server error' : 'Unexpected application error',
    mechanism: mechanism && {type: mechanism.type, handled: mechanism.handled},
    stacktrace: stacktrace && {
      frames: stacktrace.frames?.map(({filename, abs_path, function: name, lineno, colno, in_app}) => ({
        filename: filename?.split(/[?#]/, 1)[0],
        abs_path: abs_path?.split(/[?#]/, 1)[0],
        function: name, lineno, colno, in_app,
      })),
    },
  };
}

export function sentryOptions(env, service, routes) {
  const environment = env.SENTRY_ENVIRONMENT;
  const traceRate = environment === 'local-verification' ? 1 : 0.01;
  const release = env.SENTRY_RELEASE ?? env.CF_VERSION_METADATA?.id;
  const routeFor = url => {
    const pathname = URL.canParse(url) ? new URL(url).pathname : '';
    return routes.has(pathname) ? pathname : undefined;
  };

  return {
    dsn: env.SENTRY_DSN,
    environment,
    release,
    traceLifecycle: 'stream',
    tracesSampler: ({attributes, normalizedRequest}) =>
      attributes?.['sentry.op'] === 'http.server' && routeFor(normalizedRequest?.url) ? traceRate : 0,
    tracePropagationTargets: [],
    strictTraceContinuation: true,
    sendClientReports: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    integrations: defaults => [
      ...defaults.filter(({name}) => !['Console', 'Fetch', 'HttpServer'].includes(name)),
      httpServerIntegration({
        onSpanCreated(span, request) {
          const route = routeFor(request.url);
          if (route) span.setAttribute('app.route', route);
        },
      }),
    ],
    beforeSend(event) {
      const route = event.tags?.route ?? routeFor(event.request?.url);
      return {
        event_id: event.event_id,
        timestamp: event.timestamp,
        platform: event.platform,
        level: event.level,
        environment,
        release,
        tags: {
          service,
          ...(routes.has(route) && {route}),
          ...(Number.isInteger(event.tags?.status) && {status: event.tags.status}),
        },
        exception: event.exception && {values: event.exception.values?.map(scrubException)},
        debug_meta: event.debug_meta,
      };
    },
    beforeSendSpan({links, ...span}) {
      const route = span.attributes['app.route'];
      return {
        ...span,
        name: routes.has(route) ? route : 'Cloudflare operation',
        attributes: {
          ...Object.fromEntries(spanAttributes.filter(key => key in span.attributes).map(key => [key, span.attributes[key]])),
          'sentry.environment': environment,
          ...(release && {'sentry.release': release}),
          service,
        },
      };
    },
    beforeSendLog(log) {
      if (!logMessages.has(log.message)) return null;
      const attributes = log.attributes ?? {};
      return {
        ...log,
        attributes: {
          ...Object.fromEntries(logMetadata.filter(key => typeof attributes[key] === 'string').map(key => [key, attributes[key]])),
          service,
          ...(environment && {'sentry.environment': environment}),
          ...(release && {'sentry.release': release}),
          ...(routes.has(attributes.route) && {route: attributes.route}),
          ...(log.message === 'Room binding failed' && roomBindingRoutes.has(attributes.room_binding_route) && {
            room_binding_route: attributes.room_binding_route, ...roomBindingFlags(attributes),
          }),
          ...(log.message === 'Pages request failed' && typeof attributes.ray_id === 'string' &&
            /^[a-f0-9]{16}(?:-[A-Z]{3})?$/i.test(attributes.ray_id) && {ray_id: attributes.ray_id}),
          ...(roomOperations.has(attributes.operation) && {operation: attributes.operation}),
          ...(typeof attributes.object_id === 'string' && /^[0-9a-f]{64}$/i.test(attributes.object_id) && {object_id: attributes.object_id}),
          ...(typeof attributes.room_epoch === 'string' && uuid.test(attributes.room_epoch) && {room_epoch: attributes.room_epoch}),
          ...(typeof attributes.worker_version === 'string' && uuid.test(attributes.worker_version) && {worker_version: attributes.worker_version}),
          ...(typeof attributes.was_clean === 'boolean' && {was_clean: attributes.was_clean}),
          ...(log.message === 'Room socket rejected' && socketRejectionReasons.has(attributes.rejection_reason) &&
            {rejection_reason: attributes.rejection_reason}),
          ...Object.fromEntries(logNumbers.filter(key => Number.isFinite(attributes[key])).map(key => [key, attributes[key]])),
        },
      };
    },
  };
}

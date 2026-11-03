import {callback} from '../../../server/pages-auth.js';

export function onRequestGet(context) {
  return callback(context);
}

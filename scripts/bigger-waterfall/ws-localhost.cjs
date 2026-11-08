// Logitech owns 127.0.0.1:19010 on this Mac. Isolate this task's fixture on [::1]:19010.
// Both server and test workers load this shim. No application or test source is changed.
const net = require('node:net');
const port = Number(process.env.DUCKY_WS_PORT || 19010);
const matches = o => o && Number(o.port) === port && (!o.host || o.host === '127.0.0.1' || o.host === 'localhost');
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
 if (typeof args[0] === 'object' && matches(args[0])) args[0] = {...args[0], host: '::1'};
 else if (Number(args[0]) === port && args[1] === '127.0.0.1') args[1] = '::1';
 return listen.apply(this, args);
};
const connect = net.connect;
net.connect = net.createConnection = function (...args) {
 if (matches(args[0])) args[0] = {...args[0], host: '::1'};
 else if (Number(args[0]) === port && args[1] === '127.0.0.1') args[1] = '::1';
 return connect.apply(this, args);
};

function EventEmitter() {}

EventEmitter.prototype.on = function on() {
  return this;
};

EventEmitter.prototype.addListener = EventEmitter.prototype.on;

EventEmitter.prototype.once = function once() {
  return this;
};

EventEmitter.prototype.off = function off() {
  return this;
};

EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

EventEmitter.prototype.emit = function emit() {
  return false;
};

EventEmitter.prototype.removeAllListeners = function removeAllListeners() {
  return this;
};

module.exports = EventEmitter;
module.exports.EventEmitter = EventEmitter;
module.exports.default = EventEmitter;

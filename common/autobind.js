export function autobind(target, key, descriptor) {
  const fn = descriptor.value;
  if (typeof fn !== 'function') {
    return descriptor;
  }
  return {
    configurable: true,
    get() {
      const bound = fn.bind(this);
      Object.defineProperty(this, key, {
        value: bound,
        configurable: true,
        writable: true
      });
      return bound;
    }
  };
}

export default autobind;

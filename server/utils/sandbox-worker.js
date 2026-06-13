const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');
const assert = require('assert');
const Mock = require('mockjs');

try {
  const { context, callbackKeys = [], script, timeout = 3000 } = workerData;
  const sandbox = {
    ...(context || {}),
    Random: Mock.Random
  };
  if (callbackKeys.includes('assert')) {
    sandbox.assert = assert;
  }
  if (callbackKeys.includes('log')) {
    sandbox.log = msg => parentPort.postMessage({ type: 'log', msg });
  }
  const vmScript = new vm.Script(script);
  const vmContext = vm.createContext(sandbox);
  vmScript.runInContext(vmContext, { timeout });
  const result = {};
  Object.keys(context || {}).forEach(key => {
    if (typeof sandbox[key] !== 'function') {
      result[key] = sandbox[key];
    }
  });
  parentPort.postMessage({ result });
} catch (err) {
  parentPort.postMessage({ error: err.message || String(err) });
}

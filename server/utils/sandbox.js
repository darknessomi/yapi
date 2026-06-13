const { Worker } = require('worker_threads');
const path = require('path');

const ASYNC_TIMEOUT = 60000;

function serializeContext(context) {
  const data = {};
  const callbackKeys = [];
  Object.entries(context || {}).forEach(([key, value]) => {
    if (typeof value === 'function') {
      callbackKeys.push(key);
    } else {
      data[key] = value;
    }
  });
  return { data, callbackKeys };
}

module.exports = async function sandboxFn(context, script) {
  return new Promise((resolve, reject) => {
    const { data, callbackKeys } = serializeContext(context);
    const worker = new Worker(path.join(__dirname, 'sandbox-worker.js'), {
      workerData: { context: data, callbackKeys, script, timeout: ASYNC_TIMEOUT }
    });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Script execution timed out'));
    }, ASYNC_TIMEOUT);

    worker.on('message', msg => {
      if (msg.type === 'log') {
        if (typeof context?.log === 'function') {
          context.log(msg.msg);
        }
        return;
      }
      clearTimeout(timer);
      if (msg.error) {
        reject(new Error(msg.error));
        return;
      }
      resolve(msg.result);
    });
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error(`Sandbox worker exited with code ${code}`));
      }
    });
  });
};

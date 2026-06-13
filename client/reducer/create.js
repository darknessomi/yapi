import { createStore as _createStore, applyMiddleware } from 'redux';
import messageMiddleware from './middleware/messageMiddleware';

const promiseMiddleware = ({ dispatch }) => next => action => {
  if (typeof action?.then === 'function') {
    return action.then(
      resolvedAction => dispatch(resolvedAction),
      error => Promise.reject(error)
    );
  }
  const { payload } = action;
  if (!payload || typeof payload.then !== 'function') {
    return next(action);
  }
  return payload.then(
    response => dispatch({ ...action, payload: response }),
    error => dispatch({ ...action, payload: error, error: true })
  );
};
import reducer from './modules/reducer';

export default function createStore(initialState = {}) {
  const middleware = [promiseMiddleware, messageMiddleware];
  const finalCreateStore = applyMiddleware(...middleware)(_createStore);
  const store = finalCreateStore(reducer, initialState);

  return store;
}

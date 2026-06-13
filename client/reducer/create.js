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

  let finalCreateStore;
  //if (process.env.NODE_ENV === 'production') {
  finalCreateStore = applyMiddleware(...middleware)(_createStore);
  // } else {
  //   finalCreateStore = compose(
  //     applyMiddleware(...middleware),
  //     window.devToolsExtension ? window.devToolsExtension() : require('../containers/DevTools/DevTools').instrument()
  //   )(_createStore);
  // }

  const store = finalCreateStore(reducer, initialState);

  return store;
}

const mongoose = require('mongoose');
const yapi = require('../yapi.js');
const autoIncrement = require('./mongoose-auto-increment');

// Mongoose 6 defaults strictQuery to true; YApi relies on Mongoose 5 behavior.
mongoose.set('strictQuery', false);

const DEPRECATED_MONGO_OPTIONS = [
  'useNewUrlParser',
  'useUnifiedTopology',
  'useFindAndModify',
  'useCreateIndex',
  'poolSize',
  'autoReconnect',
  'reconnectTries',
  'reconnectInterval'
];

function model(model, schema) {
  if (schema instanceof mongoose.Schema === false) {
    schema = new mongoose.Schema(schema);
  }

  schema.set('autoIndex', false);

  return mongoose.model(model, schema, model);
}

function connect(callback) {
  let config = yapi.WEBCONFIG;
  let options = {};

  if (config.db.user) {
    options.user = config.db.user;
    options.pass = config.db.pass;
  }

  options = Object.assign({}, options, config.db.options);
  DEPRECATED_MONGO_OPTIONS.forEach(key => {
    delete options[key];
  });

  var connectString = '';

  if (config.db.connectString) {
    connectString = config.db.connectString;
  } else {
    connectString = `mongodb://${config.db.servername}:${config.db.port}/${config.db.DATABASE}`;
    if (config.db.authSource) {
      connectString = connectString + `?authSource=${config.db.authSource}`;
    }
  }

  let db = mongoose.connect(connectString, options).then(
    function() {
      yapi.commons.log('mongodb load success...');

      if (typeof callback === 'function') {
        callback.call(db);
      }
    },
    function(err) {
      yapi.commons.log(err + ' mongodb connect error', 'error');
    }
  );

  autoIncrement.initialize(mongoose.connection);
  return db;
}

yapi.db = model;

module.exports = {
  model: model,
  connect: connect
};

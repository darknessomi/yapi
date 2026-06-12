#!/bin/sh
set -e

if [ ! -f /yapi/init.lock ]; then
  if ! node /yapi/vendors/server/install.js; then
    node -e "
      const config = require('/yapi/config.json');
      const mongoose = require('mongoose');
      mongoose.connect('mongodb://' + config.db.servername + ':' + config.db.port + '/' + config.db.DATABASE)
        .then(() => mongoose.connection.db.collection('user').countDocuments({ email: config.adminAccount }))
        .then((count) => process.exit(count > 0 ? 0 : 1))
        .finally(() => mongoose.disconnect());
    " || exit 1
  fi
  touch /yapi/init.lock
fi

exec node /yapi/vendors/server/app.js

const baseModel = require('./base.js');
const yapi = require('../yapi.js');

const CHALLENGE_EXPIRES_SECONDS = 5 * 60;

class passkeyChallengeModel extends baseModel {
  getName() {
    return 'passkey_challenge';
  }

  getSchema() {
    return {
      uid: {
        type: Number,
        index: true
      },
      email: {
        type: String,
        index: true
      },
      type: {
        type: String,
        enum: ['register', 'auth', 'auth_conditional', 'password_login'],
        required: true
      },
      challenge: {
        type: String,
        required: true
      },
      add_time: Number,
      expires_at: Number
    };
  }

  async upsert(data) {
    let now = yapi.commons.time();
    let query = { type: data.type };
    if (data.uid) {
      query.uid = data.uid;
    } else if (data.email) {
      query.email = data.email;
    }

    await this.model
      .updateOne(
        query,
        {
          ...data,
          add_time: now,
          expires_at: now + CHALLENGE_EXPIRES_SECONDS
        },
        { upsert: true }
      )
      .exec();

    return this.model.findOne(query).exec();
  }

  async getValid(query) {
    let record = await this.model.findOne(query).exec();
    if (!record) {
      return null;
    }

    if (record.expires_at < yapi.commons.time()) {
      await this.model.deleteOne({ _id: record._id }).exec();
      return null;
    }

    return record;
  }

  del(query) {
    return this.model.deleteOne(query).exec();
  }
}

passkeyChallengeModel.CHALLENGE_EXPIRES_SECONDS = CHALLENGE_EXPIRES_SECONDS;

module.exports = passkeyChallengeModel;

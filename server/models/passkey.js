const baseModel = require('./base.js');

class passkeyModel extends baseModel {
  getName() {
    return 'passkey';
  }

  getSchema() {
    return {
      uid: {
        type: Number,
        required: true,
        index: true
      },
      credentialID: {
        type: String,
        required: true,
        unique: true,
        index: true
      },
      publicKey: {
        type: String,
        required: true
      },
      counter: {
        type: Number,
        default: 0
      },
      transports: [String],
      deviceType: String,
      backedUp: {
        type: Boolean,
        default: false
      },
      name: String,
      add_time: Number,
      last_used_time: Number
    };
  }

  save(data) {
    let passkey = new this.model(data);
    return passkey.save();
  }

  listByUid(uid) {
    return this.model
      .find({ uid })
      .sort({ _id: -1 })
      .select('_id uid transports deviceType backedUp name add_time last_used_time')
      .exec();
  }

  findByUid(uid) {
    return this.model.find({ uid }).exec();
  }

  findByCredentialID(credentialID) {
    return this.model.findOne({ credentialID }).exec();
  }

  countByUids(uids) {
    return this.model
      .aggregate([
        {
          $match: {
            uid: { $in: uids.map(uid => Number(uid)) }
          }
        },
        {
          $group: {
            _id: '$uid',
            count: { $sum: 1 }
          }
        }
      ])
      .exec();
  }

  async deleteByUidAndId(uid, id) {
    return this.model.deleteOne({ uid, _id: id }).exec();
  }

  updateCounter(credentialID, counter) {
    return this.model
      .updateOne(
        { credentialID },
        {
          counter,
          last_used_time: Math.floor(Date.now() / 1000)
        }
      )
      .exec();
  }
}

module.exports = passkeyModel;

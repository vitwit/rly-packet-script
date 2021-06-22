const mongoose = require('mongoose');
let Schema = mongoose.Schema

const schema = new Schema({

}, {
  versionKey: false,
  strict: false,
})

schema.index({ time: 1 })

module.exports = mongoose.model('unrelay_stats', schema);

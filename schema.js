const mongoose = require('mongoose');
let Schema = mongoose.Schema

const schema = new Schema({

}, {
  versionKey: false,
  strict: false,
})

module.exports = mongoose.model('unrelay_stats', schema);

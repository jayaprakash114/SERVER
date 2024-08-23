const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  videoPreview: String,
  fullVideo: String,
});

module.exports = mongoose.model('Course', courseSchema);

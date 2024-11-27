const mongoose = require('mongoose');

// User model
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    hasPurchased: { type: Boolean, default: false },
  }));

module.exports = User;
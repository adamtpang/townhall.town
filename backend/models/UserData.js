const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  list1: [String],
  list2: [{
    _id: false,  // Disable automatic _id for subdocuments
    importance: {
      type: Boolean,
      required: true,
      default: false
    },
    importanceValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1
    },
    idea: {
      type: String,
      required: true
    }
  }],
  list3: [{
    _id: false,  // Disable automatic _id for subdocuments
    importance: {
      type: Boolean,
      required: true,
      default: false
    },
    importanceValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1
    },
    urgency: {
      type: Boolean,
      required: true,
      default: false
    },
    urgencyValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1
    },
    idea: {
      type: String,
      required: true
    }
  }]
}, {
  timestamps: true,
  strict: true
});

module.exports = mongoose.model('UserData', userDataSchema);

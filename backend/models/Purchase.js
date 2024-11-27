const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  hasPurchased: {
    type: Boolean,
    default: false
  },
  purchaseDate: {
    type: Date
  },
  list1: {
    type: [String],
    default: [],
    validate: [arrayLimit, 'List 1 exceeds the limit of 10000 items']
  },
  list2: {
    type: [{
      importance: Boolean,
      importanceValue: Number,
      idea: String
    }],
    default: [],
    validate: [arrayLimit, 'List 2 exceeds the limit of 10000 items']
  },
  list3: {
    type: [{
      importance: Boolean,
      importanceValue: Number,
      urgency: Boolean,
      urgencyValue: Number,
      idea: String
    }],
    default: [],
    validate: [arrayLimit, 'List 3 exceeds the limit of 10000 items']
  },
  trashedItems: {
    type: Array,
    default: [],
    validate: [arrayLimit, 'Trash exceeds the limit of 10000 items']
  }
});

function arrayLimit(val) {
  return val.length <= 10000;
}

const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = Purchase;
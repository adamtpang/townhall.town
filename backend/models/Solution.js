const mongoose = require('mongoose');

const solutionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true
  },
  author: {
    uid: String,
    name: String,
    photoURL: String
  },
  votes: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  totalVotes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Solution', solutionSchema);
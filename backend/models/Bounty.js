const mongoose = require('mongoose');

const bountySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  solutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Solution',
    required: true
  },
  sponsor: {
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
  status: {
    type: String,
    enum: ['open', 'in_progress', 'completed', 'cancelled'],
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Bounty', bountySchema);
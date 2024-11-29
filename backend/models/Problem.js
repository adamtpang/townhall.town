const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  author: {
    uid: String,
    name: String,
    photoURL: String
  },
  totalVotes: {
    type: Number,
    default: 0
  },
  userVotes: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  relationships: [{
    type: {
      type: String,
      enum: ['causes', 'caused_by', 'related_to'],
      required: true
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true
    },
    description: String  // Optional explanation of the relationship
  }],
  stats: {
    causes: { type: Number, default: 0 },     // Problems this causes
    caused_by: { type: Number, default: 0 },  // Problems that cause this
    related_to: { type: Number, default: 0 }  // Related problems
  }
});

// Add index for userVotes
problemSchema.index({ 'userVotes': 1 });

module.exports = mongoose.model('Problem', problemSchema);
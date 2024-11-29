const express = require('express');
const router = express.Router();
const Problem = require('../models/Problem');

// Get all problems
router.get('/', async (req, res) => {
  try {
    const problems = await Problem.find().sort({ createdAt: -1 });
    res.json(problems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new problem
router.post('/', async (req, res) => {
  console.log('Received problem data:', req.body);  // Debug log

  try {
    const problem = new Problem({
      title: req.body.title,
      description: req.body.description || '',
      location: req.body.location,
      author: {
        uid: req.body.author.uid,
        name: req.body.author.name,
        photoURL: req.body.author.photoURL
      },
      votes: 0,
      createdAt: new Date()
    });

    console.log('Created problem object:', problem);  // Debug log

    const newProblem = await problem.save();
    console.log('Saved problem:', newProblem);  // Debug log

    res.status(201).json(newProblem);
  } catch (error) {
    console.error('Error creating problem:', error);  // Debug log
    res.status(400).json({
      message: error.message,
      details: error.errors  // Include validation errors if any
    });
  }
});

// Update vote
router.patch('/:id/vote', async (req, res) => {
  try {
    const { direction, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const problem = await Problem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    // Initialize userVotes if needed
    if (!problem.userVotes) {
      problem.userVotes = new Map();
    }

    const currentVote = problem.userVotes.get(userId);

    // Handle vote changes
    if (currentVote === direction) {
      // Remove vote if clicking same direction
      problem.userVotes.delete(userId);
    } else if (currentVote && direction !== currentVote) {
      // If changing vote direction, remove the vote instead of changing it
      problem.userVotes.delete(userId);
    } else {
      // Add new vote
      problem.userVotes.set(userId, direction);
    }

    // Calculate total votes
    let total = 0;
    problem.userVotes.forEach((vote) => {
      total += vote === 'up' ? 1 : -1;
    });

    // Update total votes
    problem.totalVotes = total;
    await problem.save({ validateBeforeSave: false });

    res.json({
      ...problem.toObject(),
      userVote: problem.userVotes.get(userId) || null
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete problem
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    const problem = await Problem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    // Check if user is the author
    if (problem.author.uid !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this problem' });
    }

    await Problem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Problem deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add this route to get a single problem
router.get('/:id', async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
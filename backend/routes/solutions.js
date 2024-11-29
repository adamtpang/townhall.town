const express = require('express');
const router = express.Router();
const Solution = require('../models/Solution');

// Get all solutions
router.get('/', async (req, res) => {
  try {
    const solutions = await Solution.find().sort({ createdAt: -1 });
    res.json(solutions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get solutions for a specific problem
router.get('/problem/:problemId', async (req, res) => {
  try {
    const solutions = await Solution.find({ problemId: req.params.problemId })
      .sort({ createdAt: -1 });
    res.json(solutions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new solution
router.post('/', async (req, res) => {
  try {
    const solution = new Solution({
      title: req.body.title,
      description: req.body.description || '',
      problemId: req.body.problemId,
      author: req.body.author,
      votes: new Map(),
      totalVotes: 0
    });

    const newSolution = await solution.save();
    res.status(201).json(newSolution);
  } catch (error) {
    console.error('Error creating solution:', error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
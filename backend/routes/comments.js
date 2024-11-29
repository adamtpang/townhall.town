const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');

// Get comments for a specific problem
router.get('/problem/:problemId', async (req, res) => {
  try {
    const comments = await Comment.find({ problemId: req.params.problemId })
      .sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new comment
router.post('/', async (req, res) => {
  try {
    const comment = new Comment(req.body);
    const newComment = await comment.save();
    res.status(201).json(newComment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
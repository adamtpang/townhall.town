const express = require('express');
const router = express.Router();
const Bounty = require('../models/Bounty');

// Get all bounties
router.get('/', async (req, res) => {
  try {
    const bounties = await Bounty.find().sort({ createdAt: -1 });
    res.json(bounties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bounties for a specific solution
router.get('/solution/:solutionId', async (req, res) => {
  try {
    const bounties = await Bounty.find({ solutionId: req.params.solutionId })
      .sort({ createdAt: -1 });
    res.json(bounties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new bounty
router.post('/', async (req, res) => {
  try {
    const bounty = new Bounty({
      amount: req.body.amount,
      description: req.body.description || '',
      solutionId: req.body.solutionId,
      sponsor: req.body.sponsor,
      votes: new Map(),
      totalVotes: 0,
      status: 'open'
    });

    const newBounty = await bounty.save();
    res.status(201).json(newBounty);
  } catch (error) {
    console.error('Error creating bounty:', error);
    res.status(400).json({ message: error.message });
  }
});

// Vote on a bounty
router.patch('/:id/vote', async (req, res) => {
  try {
    const { direction, userId } = req.body;
    const bounty = await Bounty.findById(req.params.id);

    if (!bounty) {
      return res.status(404).json({ message: 'Bounty not found' });
    }

    const currentVote = bounty.votes.get(userId);

    if (currentVote === direction) {
      bounty.votes.delete(userId);
    } else {
      bounty.votes.set(userId, direction);
    }

    let total = 0;
    bounty.votes.forEach((vote) => {
      total += vote === 'up' ? 1 : -1;
    });
    bounty.totalVotes = total;

    await bounty.save();
    res.json(bounty);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a bounty
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    const bounty = await Bounty.findById(req.params.id);

    if (!bounty) {
      return res.status(404).json({ message: 'Bounty not found' });
    }

    if (bounty.sponsor.uid !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Bounty.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bounty deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
// routes/items.js

const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const verifyToken = require('../middleware/verifyToken');

// GET /api/items - Fetch items for the authenticated user
router.get('/api/items', verifyToken, async (req, res) => {
  const userId = req.user.uid;

  try {
    let items = await Item.findOne({ userId });

    if (!items) {
      // If no items exist for the user, create a new document
      items = new Item({ userId, list1: [], list2: [], list3: [] });
      await items.save();
    }

    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /api/items - Save items for the authenticated user
router.post('/api/items', verifyToken, async (req, res) => {
  const userId = req.user.uid;
  const { list1, list2, list3 } = req.body;

  try {
    let items = await Item.findOne({ userId });

    if (items) {
      // Update existing items
      items.list1 = list1;
      items.list2 = list2;
      items.list3 = list3;
      await items.save();
    } else {
      // Create new items document
      items = new Item({ userId, list1, list2, list3 });
      await items.save();
    }

    res.json({ message: 'items saved successfully' });
  } catch (error) {
    console.error('Error saving items:', error);
    res.status(500).json({ error: 'Failed to save items' });
  }
});

module.exports = router;

// routes/purchases.js

const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');

const CHUNK_SIZE = 50; // Define CHUNK_SIZE constant

// Log to verify route is registered
console.log('Registering purchase routes...');

// Manual purchase setter
router.post('/api/purchases/set-purchase', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      console.log('No email provided in request');
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('Setting purchase for email:', email);

    const purchase = await Purchase.findOneAndUpdate(
      { email: { $regex: new RegExp(`^${email}$`, 'i') } },
      {
        email: email.toLowerCase(),
        hasPurchased: true
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    console.log('Purchase record created/updated:', purchase);
    res.json({
      success: true,
      purchase,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error setting purchase:', error);
    res.status(500).json({ error: 'Failed to set purchase', details: error.message });
  }
});

// Check purchase status
router.get('/api/purchases/check-purchase', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const purchase = await Purchase.findOne({ email });
    return res.json({
      hasPurchased: Boolean(purchase?.hasPurchased),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking purchase:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Load lists
router.get('/api/purchases/lists', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const purchase = await Purchase.findOne({ email });
    if (!purchase) {
      return res.json({
        list1: [],
        list2: [],
        list3: [],
        trashedItems: []
      });
    }

    res.json({
      list1: purchase.list1 || [],
      list2: purchase.list2 || [],
      list3: purchase.list3 || [],
      trashedItems: purchase.trashedItems || []
    });
  } catch (error) {
    console.error('Error loading lists:', error);
    res.status(500).json({ error: 'Failed to load lists' });
  }
});

// Save lists
router.post('/api/purchases/save-lists', async (req, res) => {
  try {
    const { email, lists } = req.body;
    if (!email || !lists) {
      return res.status(400).json({ error: 'Email and lists are required' });
    }

    await Purchase.findOneAndUpdate(
      { email },
      {
        $set: {
          list1: lists.list1,
          list2: lists.list2,
          list3: lists.list3,
          trashedItems: lists.trashedItems,
          lastUpdated: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving lists:', error);
    res.status(500).json({ error: 'Failed to save lists' });
  }
});

// Clear list
router.post('/api/purchases/clear-list', async (req, res) => {
  try {
    const { email, listNumber, itemsToTrash } = req.body;
    if (!email || !listNumber) {
      return res.status(400).json({ error: 'Email and listNumber are required' });
    }

    const update = {};
    if (listNumber === 1) update.list1 = [];
    else if (listNumber === 2) update.list2 = [];
    else if (listNumber === 3) update.list3 = [];
    else if (listNumber === 'trash') update.trashedItems = [];

    // If we're clearing a list (not trash) and have items to move to trash
    if (listNumber !== 'trash' && itemsToTrash?.length > 0) {
      update.$push = {
        trashedItems: { $each: itemsToTrash, $position: 0 }
      };
    }

    await Purchase.findOneAndUpdate(
      { email },
      { $set: update },
      { new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing list:', error);
    res.status(500).json({ error: 'Failed to clear list' });
  }
});

// Get user data
router.get('/api/get-user-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Getting user data for:', userId);
    const purchase = await Purchase.findOne({ userId });

    res.json({
      success: true,
      userData: purchase || { lists: { list1: [], list2: [], list3: [] } }
    });
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Add save user data route
router.post('/api/save-user-data', async (req, res) => {
  try {
    const { userId, data } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Saving user data for:', userId);
    console.log('Data:', data);

    const purchase = await Purchase.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          ...data
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      purchase
    });
  } catch (error) {
    console.error('Error saving user data:', error);
    res.status(500).json({ error: 'Failed to save user data' });
  }
});

// Handle chunk syncs
router.post('/api/purchases/sync-chunk', async (req, res) => {
  try {
    const { email, listName, chunk } = req.body;

    console.log(`Processing ${listName} chunk ${chunk.index + 1}/${chunk.total} for ${email}`);

    // Use findOneAndUpdate instead of find and save
    const result = await Purchase.findOneAndUpdate(
      { email },
      {
        $set: {
          [`${listName}`]: chunk.items
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({
      success: true,
      chunkProcessed: chunk.index + 1,
      totalChunks: chunk.total
    });

  } catch (error) {
    console.error('Error processing chunk:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle sync completion
router.post('/api/purchases/sync-complete', async (req, res) => {
  try {
    const { email, metadata } = req.body;

    const purchase = await Purchase.findOne({ email });
    if (purchase) {
      purchase.lastSyncedAt = metadata.lastSyncedAt;
      await purchase.save();
    }

    res.json({
      success: true,
      message: 'Sync completed successfully',
      timestamp: metadata.lastSyncedAt
    });

  } catch (error) {
    console.error('Error completing sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a clear trash endpoint
router.post('/api/purchases/clear-trash', async (req, res) => {
  try {
    const { email } = req.body;

    const purchase = await Purchase.findOne({ email });
    if (purchase) {
      purchase.trashedItems = [];
      await purchase.save();
    }

    res.json({
      success: true,
      message: 'Trash cleared'
    });
  } catch (error) {
    console.error('Error clearing trash:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

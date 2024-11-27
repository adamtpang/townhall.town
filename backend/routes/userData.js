const express = require('express');
const router = express.Router();
const UserData = require('../models/UserData');

// Save user data
router.post('/api/save-user-data', async (req, res) => {
  try {
    const { userId, ...data } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log('Saving data for user:', userId);

    // Use findOneAndUpdate with upsert to create or update
    const userData = await UserData.findOneAndUpdate(
      { userId },
      { ...data },
      { upsert: true, new: true, runValidators: true }
    );

    console.log('Data saved successfully:', userData);
    res.json({ success: true, data: userData });
  } catch (error) {
    console.error('Error saving user data:', error);
    res.status(500).json({ error: 'Failed to save user data', details: error.message });
  }
});

// Get user data
router.get('/api/get-user-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log('Fetching data for user:', userId);

    const userData = await UserData.findOne({ userId });

    if (!userData) {
      console.log('No existing data found, returning empty state');
      return res.json({
        list1: [],
        list2: [],
        list3: []
      });
    }

    // Ensure all items have proper values
    const sanitizedData = {
      ...userData.toObject(),
      list2: userData.list2.map(item => ({
        importance: Boolean(item.importance),
        importanceValue: Number(item.importanceValue || 0),
        idea: String(item.idea)
      })),
      list3: userData.list3.map(item => ({
        importance: Boolean(item.importance),
        importanceValue: Number(item.importanceValue || 0),
        urgency: Boolean(item.urgency),
        urgencyValue: Number(item.urgencyValue || 0),
        idea: String(item.idea)
      }))
    };

    console.log('Found and sanitized user data:', sanitizedData);
    res.json(sanitizedData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data', details: error.message });
  }
});

module.exports = router;

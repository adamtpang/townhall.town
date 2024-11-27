const express = require('express');
const router = express.Router();

// Handle individual chunks
router.post('/sync-chunk', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const { email, chunk } = req.body;
    console.log(`Processing chunk ${chunk.currentChunk}/${chunk.totalChunks} for ${email}`);

    let purchase = await Purchase.findOne({ email });
    if (!purchase) {
      purchase = new Purchase({ email });
    }

    // Update the appropriate section of the document
    const startIndex = chunk.startIndex;
    const items = chunk.items;

    // Merge the chunk with existing data
    purchase.list1.splice(startIndex, items.length, ...items);

    await purchase.save();

    res.json({
      success: true,
      chunkProcessed: chunk.currentChunk
    });

  } catch (error) {
    console.error('Chunk sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle sync completion
router.post('/sync-complete', express.json(), async (req, res) => {
  try {
    const { email, metadata } = req.body;

    let purchase = await Purchase.findOne({ email });
    if (!purchase) {
      purchase = new Purchase({ email });
    }

    purchase.lastSyncedAt = metadata.lastSyncedAt;
    await purchase.save();

    res.json({
      success: true,
      message: 'Sync completed',
      listSizes: {
        list1: purchase.list1.length,
        list2: purchase.list2.length,
        list3: purchase.list3.length
      }
    });

  } catch (error) {
    console.error('Sync completion error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
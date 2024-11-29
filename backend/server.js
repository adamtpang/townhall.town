// server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const problemsRouter = require('./routes/problems');
const commentsRouter = require('./routes/comments');
const solutionsRouter = require('./routes/solutions');
const bountiesRouter = require('./routes/bounties');

app.use('/api/problems', problemsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/solutions', solutionsRouter);
app.use('/api/bounties', bountiesRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

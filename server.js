//server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret_key'; // Replace with a secure secret key

// MongoDB connection
const mongoURI = 'mongodb+srv://Sapphire:test123@cluster0.9qkusoa.mongodb.net/'; // Replace with your actual connection string

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Define a Feedback schema
const feedbackSchema = new mongoose.Schema({
  lecturerName: { type: String, required: true },
  feedback: { type: String, required: true },
  course: { type: String, required: true } // Course/module code field
}, {
  timestamps: true
});

// Create a Feedback model
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Route to submit feedback
app.post('/feedback', async (req, res) => {
  try {
    const { lecturerName, course, feedback } = req.body;
    const newFeedback = new Feedback({ lecturerName, course, feedback });
    await newFeedback.save();
    console.log('Feedback received:', lecturerName, course, feedback);
    res.status(201).json({ message: 'Feedback submitted successfully!' });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to get all feedback or filtered feedback
app.get('/feedback', async (req, res) => {
  try {
    const { lecturerName, course } = req.query;

    const query = {};
    if (lecturerName) query.lecturerName = lecturerName;
    if (course) query.course = course;

    const feedbackList = await Feedback.find(query);
    res.json(feedbackList);
  } catch (error) {
    console.error('Error retrieving feedback:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Define User schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'lecturer', 'admin'], required: true } // User role
});

// Password hashing before saving the user
userSchema.pre('save', async function(next) {
  const user = this;
  if (!user.isModified('password')) return next();
  user.password = await bcrypt.hash(user.password, 10);
  next();
});

const User = mongoose.model('User', userSchema);

// Register Route
app.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = new User({ username, password, role });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Access Denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Protected Route Example (Admin only)
app.get('/admin', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json({ message: 'Welcome Admin!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

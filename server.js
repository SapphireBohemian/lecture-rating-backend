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

// Use feedback routes
//app.use('/feedback', feedbackRoutes);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Define a Feedback schema
const feedbackSchema = new mongoose.Schema({
  lecturerName: { type: String, required: true },
  feedback: { type: String, required: true },
  course: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 10 } // Course/module code field
}, {
  timestamps: true
});

// Create a Feedback model
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Route to submit feedback
app.post('/feedback', async (req, res) => {
  try {
    const { lecturerName, course, feedback, rating } = req.body;
    const newFeedback = new Feedback({ lecturerName, course, feedback, rating });
    await newFeedback.save();
    console.log('Feedback received:', lecturerName, course, feedback, rating);
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

// Route to get average ratings for each lecturer
app.get('/feedback/average-ratings', async (req, res) => {
  try {
    const ratings = await Feedback.aggregate([
      {
        $group: {
          _id: "$lecturerName",
          averageRating: { $avg: "$rating" },
        },
      },
      {
        $sort: { averageRating: -1 }, // Sort by highest rating
      },
    ]);
    res.json(ratings);
  } catch (error) {
    console.error('Error retrieving average ratings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to calculate average ratings for each lecturer
app.get('/analytics/average-ratings', async (req, res) => {
  try {
    const averageRatings = await Feedback.aggregate([
      {
        $group: {
          _id: "$lecturerName",
          averageRating: { $avg: "$rating" }
        }
      },
      { $sort: { averageRating: -1 } }
    ]);
    res.json(averageRatings);
  } catch (error) {
    console.error('Error calculating average ratings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to calculate rating trends over time for each lecturer
app.get('/analytics/rating-trends', async (req, res) => {
  try {
    const trends = await Feedback.aggregate([
      {
        $group: {
          _id: { lecturerName: "$lecturerName", date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } },
          averageRating: { $avg: "$rating" }
        }
      },
      { $sort: { "_id.date": 1 } }
    ]);
    res.json(trends);
  } catch (error) {
    console.error('Error calculating rating trends:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Route to delete feedback by ID
app.delete('/feedback/:id', async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Define User schema with isApproved field
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'lecturer', 'admin'], required: true },
  isApproved: { type: Boolean, default: false } // New field for approval status
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

    // Automatically approve admin users
    const isApproved = role === 'admin' ? true : false;

    const newUser = new User({ username, password, role, isApproved });
    await newUser.save();

    const approvalMessage = isApproved ? 'User registered successfully and approved' : 'User registered successfully, awaiting approval';
    res.status(201).json({ message: approvalMessage });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Login Route
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid username or password' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ message: 'Invalid username or password' });
    if (!user.isApproved) return res.status(403).json({ message: 'Account not approved by admin' });

    // Generate JWT token
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Admin approval route for users
app.put('/approve-user/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User approved successfully', user });
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

// Retrieve users by role (e.g., students or lecturers)
app.get('/users', async (req, res) => {
  try {
    const { role } = req.query; // Get role from query
    const query = role ? { role } : {}; // Filter by role if provided
    const users = await User.find(query); // Fetch users with or without role filter
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving users' });
  }
});


// Add a new user (used for adding students or lecturers)
app.post('/users', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const newUser = new User({ username, password, role });
    await newUser.save();
    res.status(201).json({ message: 'User added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding user' });
  }
});

// Delete a user by ID
app.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user' });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

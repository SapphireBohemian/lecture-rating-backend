//server.js
require('dotenv').config();


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
// Import routes and middleware
//const feedbackRoutes = require('./routes/feedback');
const { authenticateToken } = require('./middleware/auth');

const { sendEmail } = require('./emailService');

// Define a Feedback schema
// In models/feedback.js or wherever your Feedback schema is defined

const feedbackSchema = new mongoose.Schema({
  lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // References lecturer's user ID
  lecturerName: { type: String, required: true }, // Lecturer's name for display purposes
  feedback: { type: String, required: true },
  course: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 10 },
  department: {type: String, required: true},
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Student ID
}, {
  timestamps: true
});

// Create a Feedback model
const Feedback = mongoose.model('Feedback', feedbackSchema);




// Submit feedback with lecturer association
app.post('/feedback', authenticateToken, async (req, res) => {
  console.log('Request body:', req.body); // Log the request body for debugging
  try {
    const { lecturerName, course, feedback, rating, department } = req.body;

    // Find the lecturer's user ID based on the provided lecturer name
    const lecturer = await User.findOne({ username: lecturerName, role: 'lecturer' });
    // Validation check
    if (!lecturerName || !course || !feedback || !rating || !department) {
      return res.status(400).json({ message: 'All fields are required.' });
  }

    const newFeedback = new Feedback({
      lecturerId: lecturer._id, // Use lecturer ID
      lecturerName: lecturer.username, // Store lecturer name
      course,
      feedback,
      rating,
      department,
      userId: req.user.userId // ID of the student submitting the feedback
    });

    await newFeedback.save();

    // Send email notification to the lecturer
    const subject = 'New Feedback Received';
    const text = `Hello ${lecturer.name},\n\nYou have received new feedback for your course: ${course}.`;
    const html = `<p>Hello ${lecturer.name},</p><p>You have received new feedback for your course: <strong>${course}</strong>.</p>`;

    await sendEmail(lecturer.email, subject, text, html);

    res.status(201).json({ message: 'Feedback submitted successfully!' });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Get feedback specific to the logged-in lecturer
app.get('/feedback', authenticateToken, async (req, res) => {
  const { lecturerName, course, department } = req.query;

  // Lecturer-specific feedback retrieval
  let query = {};
  if (req.user.role === 'lecturer') {
    query.lecturerId = req.user.userId; // Only show feedback for this lecturer
  } else if (req.user.role === 'student') {
    query.userId = req.user.userId; // Only show feedback submitted by this student
  }

  if (lecturerName) query.lecturerName = lecturerName;
  if (course) query.course = course;
  if (department) query.department = department;

  try {
    const feedbacks = await Feedback.find(query).populate('lecturerId', 'username'); // Populate lecturer details if needed
    res.json(feedbacks);
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
  isApproved: { type: Boolean, default: false },
  email: { type: String, required: true, unique: true }, // New email field
  name: { type: String, required: true },                // New name field
  surname: { type: String, required: true },             // New surname field
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
    const { username, password, role, email, name, surname } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const isApproved = role === 'admin' ? true : false;

    const newUser = new User({ 
      username, 
      password, 
      role, 
      isApproved, 
      email, 
      name, 
      surname 
    });
    await newUser.save();

     const subject = 'Welcome to the Lecture Rating Application!';
    const text = `Hi ${name},\n\nThank you for registering with us!`;
    const html = `<p>Hi ${name},</p><p>Thank you for registering with us!</p>`;

    await sendEmail(email, subject, text, html);

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
    res.json({ token, role: user.role, username: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Admin approval route for users
app.put('/approve-user/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Send email notification to the user upon approval
    const subject = 'Account Approved';
    const text = `Hello ${user.name},\n\nYour account has been approved by the admin. You can now log in to the application.`;
    const html = `<p>Hello ${user.name},</p><p>Your account has been approved by the admin. You can now log in to the application.</p>`;

    await sendEmail(user.email, subject, text, html);

    res.json({ message: 'User approved successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


/*// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Access Denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}*/

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
    const { name, surname, email, username, password, role } = req.body;
    const newUser = new User({ name, surname, email, username, password, role });
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

// Profile Update Route
app.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { email, name, surname, password } = req.body;

    const updates = {};
    if (email) updates.email = email;
    if (name) updates.name = name;
    if (surname) updates.surname = surname;
    if (password) updates.password = await bcrypt.hash(password, 10); // Hash password if updated

    const updatedUser = await User.findByIdAndUpdate(req.user.userId, updates, { new: true });
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    // Send email notification to the user upon approval
    const subject = 'Profile Updated';
    const text = `Hello ${name},\n\nYour profile has been updated.`;
    const html = `<p>Hello ${name},</p><p>Your profile has been updated.</p>`;

    await sendEmail(email, subject, text, html);

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get User Profile Route
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error retrieving profile:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.put('/user/profile', authenticateToken, async (req, res) => {
  try {
    const updatedData = req.body;
    if (updatedData.password) {
      updatedData.password = await bcrypt.hash(updatedData.password, 10);
    }
    const user = await User.findByIdAndUpdate(req.user.userId, updatedData, { new: true });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

app.delete('/user/account', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    await User.findByIdAndDelete(req.user.userId);

    // Send email notification to the user upon account deletion
    const subject = 'Account Deleted';
    const text = `Hello ${user.name},\n\nYour account has been successfully deleted.`;
    const html = `<p>Hello ${user.name},</p><p>Your account has been successfully deleted.</p>`;

    await sendEmail(user.email, subject, text, html);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting account' });
  }
});




// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on https://localhost:${PORT}`);
});

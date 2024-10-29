//router/feedback.js
const express = require('express');
const router = express.Router();
const Feedback = require('../models/feedback'); // Import the Feedback model

// Submit new feedback
router.post('/', async (req, res) => {
    const { lecturerName, feedback, course, rating } = req.body; // Include course
    try {
        const newFeedback = new Feedback({ lecturerName, feedback, course, rating });
        const result = await newFeedback.save();
        res.status(201).json(result);
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// Get all feedback or filtered feedback
router.get('/', async (req, res) => {
    const { lecturerName, course } = req.query; // Retrieve filter options from query params

    let query = {};
    if (lecturerName) query.lecturerName = lecturerName;
    if (course) query.course = course;

    try {
        const feedbacks = await Feedback.find(query);
        res.json(feedbacks);
    } catch (error) {
        console.error('Error retrieving feedback:', error);
        res.status(500).json({ error: 'Failed to retrieve feedback' });
    }
});

// Get average ratings for the top 2 lecturers only
router.get('/average-ratings', async (req, res) => {
    try {
        const ratings = await Feedback.aggregate([
            {
                $group: {
                    _id: "$lecturerName",
                    averageRating: { $avg: "$rating" },
                    feedbackCount: { $sum: 1 } // Count of feedbacks
                },
            },
            {
                $sort: { averageRating: -1 }, // Sort by highest rating
            },
            {
                $limit: 2 // Limit to top 2 lecturers
            }
        ]);

        // Check if we got any ratings
        if (ratings.length === 0) {
            return res.status(404).json({ message: 'No lecturers found' });
        }

        // Respond with the top 2 lecturers
        res.json(ratings);
    } catch (error) {
        console.error('Error retrieving average ratings:', error);
        res.status(500).json({ error: 'Failed to retrieve average ratings' });
    }
});

// Update feedback by ID
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { lecturerName, feedback, course, rating } = req.body;

    try {
        const updatedFeedback = await Feedback.findByIdAndUpdate(id, { lecturerName, feedback, course, rating }, { new: true });
        if (!updatedFeedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }
        res.json(updatedFeedback);
    } catch (error) {
        console.error('Error updating feedback:', error);
        res.status(500).json({ error: 'Failed to update feedback' });
    }
});

// Delete feedback by ID
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const deletedFeedback = await Feedback.findByIdAndDelete(id);
        if (!deletedFeedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }
        res.json({ message: 'Feedback deleted successfully' });
    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({ error: 'Failed to delete feedback' });
    }
});

module.exports = router;

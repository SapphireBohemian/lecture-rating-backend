//router/feedback.js
const express = require('express');
const router = express.Router();
const Feedback = require('../models/feedback'); // Import the Feedback model

// Submit new feedback
router.post('/', (req, res) => {
    const { lecturerName, feedback, course, rating } = req.body; // Include course

    const newFeedback = new Feedback({
        lecturerName,
        feedback,
        course,
        rating // Save course/moduleCode
    });

    newFeedback.save()
        .then(result => res.status(201).json(result))
        .catch(error => res.status(500).json({ error: 'Failed to submit feedback' }));
});

// Get all feedback or filtered feedback
router.get('/', (req, res) => {
    const { lecturerName, course } = req.query; // Retrieve filter options from query params

    let query = {};
    if (lecturerName) query.lecturerName = lecturerName;
    if (course) query.course = course;

    Feedback.find(query)
        .then(feedbacks => res.json(feedbacks))
        .catch(error => res.status(500).json({ error: 'Failed to retrieve feedback' }));
});

// Update feedback by ID
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { lecturerName, feedback, course, rating } = req.body;

    Feedback.findByIdAndUpdate(id, { lecturerName, feedback, course, rating }, { new: true })
        .then(updatedFeedback => res.json(updatedFeedback))
        .catch(error => res.status(500).json({ error: 'Failed to update feedback' }));
});

// Delete feedback by ID
router.delete('/:id', (req, res) => {
    const { id } = req.params;

    Feedback.findByIdAndDelete(id)
        .then(() => res.json({ message: 'Feedback deleted successfully' }))
        .catch(error => res.status(500).json({ error: 'Failed to delete feedback' }));
});

module.exports = router;

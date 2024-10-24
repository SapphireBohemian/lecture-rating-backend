//router/feedback.js
router.post('/', (req, res) => {
    const { lecturerName, feedback, course } = req.body; // Include course
  
    const newFeedback = new Feedback({
      lecturerName,
      feedback,
      course  // Save course/moduleCode
    });
  
    newFeedback.save()
      .then(result => res.json(result))
      .catch(error => res.status(500).json({ error: 'Failed to submit feedback' }));
  });
  
  // Filter feedback by lecturer name or course
  router.get('/', (req, res) => {
    const { lecturerName, course } = req.query; // Retrieve filter options from query params
  
    let query = {};
    if (lecturerName) query.lecturerName = lecturerName;
    if (course) query.course = course;
  
    Feedback.find(query)
      .then(feedbacks => res.json(feedbacks))
      .catch(error => res.status(500).json({ error: 'Failed to retrieve feedback' }));
  });
  
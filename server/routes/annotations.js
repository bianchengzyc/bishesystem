const express = require('express');
const router = express.Router();
const authMiddleware = require('../utils/authMiddleware');
const Annotation = require('../models/Annotation');
const Image = require('../models/Image');

// @route   GET /api/annotations/image/:imageId
// @desc    Get all annotations for a specific image
// @access  Protected
router.get('/image/:imageId', authMiddleware, async (req, res) => {
  try {
    const annotations = await Annotation.findAll({
      where: { image_id: req.params.imageId },
      include: [Image]
    });
    res.json({ annotations });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/annotations/:imageId
// @desc    Save multiple annotations for an image
// @access  Protected
router.post('/:imageId', authMiddleware, async (req, res) => {
  try {
    const { annotations } = req.body;
    const imageId = req.params.imageId;
    const user_id = req.user.id;

    // Check if image exists
    const image = await Image.findByPk(imageId);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Delete existing annotations for this image
    await Annotation.destroy({
      where: { image_id: imageId }
    });

    // Create new annotations
    const savedAnnotations = [];
    for (const annotation of annotations) {
      const saved = await Annotation.create({
        image_id: imageId,
        user_id,
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        label_class: annotation.label_class || 0
      });
      savedAnnotations.push(saved);
    }

    res.json({
      success: true,
      message: 'Annotations saved successfully',
      annotations: savedAnnotations
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/annotations
// @desc    Create a new annotation
// @access  Protected
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { image_id, x, y, width, height, label_class } = req.body;
    const user_id = req.user.id;

    // Check if image exists
    const image = await Image.findByPk(image_id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const annotation = await Annotation.create({
      image_id,
      user_id,
      x,
      y,
      width,
      height,
      label_class: label_class || 0
    });

    res.status(201).json(annotation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/annotations/:id
// @desc    Update an existing annotation
// @access  Protected
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { x, y, width, height, label_class } = req.body;

    // Find the annotation
    const annotation = await Annotation.findByPk(req.params.id);
    if (!annotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }

    // Update the annotation
    await annotation.update({
      x,
      y,
      width,
      height,
      label_class: label_class !== undefined ? label_class : annotation.label_class
    });

    res.json(annotation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/annotations/:id
// @desc    Delete an annotation
// @access  Protected
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Find the annotation
    const annotation = await Annotation.findByPk(req.params.id);
    if (!annotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }

    // Delete the annotation
    await annotation.destroy();
    res.json({ message: 'Annotation deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
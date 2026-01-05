const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const authMiddleware = require('../utils/authMiddleware');
const upload = require('../utils/uploadConfig');
const Image = require('../models/Image');
const Annotation = require('../models/Annotation');
const path = require('path');

// @route   GET /api/images
// @desc    Get all images with pagination and filtering
// @access  Protected
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, region, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (region) where.region = region;
    if (startDate || endDate) {
      where.capture_date = {};
      if (startDate) where.capture_date[Op.gte] = new Date(startDate);
      if (endDate) where.capture_date[Op.lte] = new Date(endDate);
    }

    // 获取所有图像
    const { count, rows } = await Image.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['uploaded_at', 'DESC']]
    });

    // 导入Annotation模型
    const Annotation = require('../models/Annotation');

    // 为每个图像获取标注数量
    const imagesWithAnnotationCount = await Promise.all(
      rows.map(async (image) => {
        // 获取标注数量
        const annotationCount = await Annotation.count({
          where: { image_id: image.image_id }
        });

        // 转换为前端期望的数据结构
        return {
          image_id: image.image_id,
          file_name: image.filename,
          file_path: image.file_path,
          upload_time: image.uploaded_at,
          image_width: image.image_width || 0,
          image_height: image.image_height || 0,
          annotation_count: annotationCount,
          region: image.region,
          capture_date: image.capture_date,
          resolution: image.resolution,
          crs: image.crs
        };
      })
    );

    res.json({
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      images: imagesWithAnnotationCount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/images/upload
// @desc    Upload a new image with metadata
// @access  Protected
router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { capture_date, region, resolution, crs } = req.body;
    const user_id = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get image dimensions
    const sizeOf = require('image-size');
    const dimensions = sizeOf(req.file.path);

    // Create image record
    const image = await Image.create({
      filename: req.file.originalname,
      file_path: req.file.path,
      capture_date: new Date(capture_date),
      region,
      resolution: parseFloat(resolution),
      crs: crs || 'EPSG:32632',
      uploaded_by: user_id,
      image_width: dimensions.width,
      image_height: dimensions.height
    });

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      image
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   GET /api/images/:id
// @desc    Get a single image by ID
// @access  Protected
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    res.json(image);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/images/:id
// @desc    Delete an image and its associated annotations
// @access  Protected
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    console.log('Deleting image:', image.image_id, image.filename);

    // First, delete all associated annotations
    const deletedAnnotations = await Annotation.destroy({
      where: { image_id: image.image_id }
    });
    console.log(`Deleted ${deletedAnnotations} annotations for image ${image.image_id}`);

    // Delete the image record
    await image.destroy();
    console.log('Image record deleted successfully');

    // Finally, delete the file from filesystem
    const fs = require('fs');
    if (fs.existsSync(image.file_path)) {
      fs.unlinkSync(image.file_path);
      console.log('Image file deleted from filesystem');
    } else {
      console.warn('Image file not found on filesystem:', image.file_path);
    }

    res.json({
      message: 'Image deleted successfully',
      deletedImageId: image.image_id,
      deletedAnnotations: deletedAnnotations,
      deletedFile: image.filename
    });
  } catch (err) {
    console.error('Delete image error:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      message: 'Server Error',
      error: err.message
    });
  }
});

// @route   GET /api/images/view/:filePath
// @desc    View an uploaded image
// @access  Public (图像本身已存储在服务器，通过应用层面控制访问)
router.get('/view/:filePath', async (req, res) => {
  try {
    let { filePath } = req.params;

    // 处理URL编码问题
    filePath = decodeURIComponent(filePath);

    // 防止路径遍历攻击
    const safePath = path.normalize(filePath);
    if (safePath.includes('..')) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    // 从服务器根目录构建绝对路径
    const fullPath = path.join(__dirname, '../', safePath);
    console.log(`Trying to access image: ${fullPath}`);

    // 检查文件是否存在
    const fs = require('fs');
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      return res.status(404).json({ message: 'Image not found' });
    }

    // 返回图像文件
    res.sendFile(fullPath);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
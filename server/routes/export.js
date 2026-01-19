// Debug: Export routes module loading
console.log('=== Loading export routes module ===');

const express = require('express');
const router = express.Router();

// Debug: Middleware and models loading
console.log('=== Loading middleware and models ===');
const authMiddleware = require('../utils/authMiddleware');
const Image = require('../models/Image');
const Annotation = require('../models/Annotation');
const { generateYoloLabel } = require('../utils/yoloExporter');
const { generateCocoData } = require('../utils/cocoExporter');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver'); // Need to install this dependency later

// Debug: Export router created
console.log('=== Export router created ===');

// @route   GET /api/export
// @desc    Export annotations in specified format (YOLO or COCO)
// @access  Public (temporarily for testing)
router.get('/', async (req, res) => {
  try {
    console.log('=== Export request received ===');
    console.log('Query params:', req.query);

    // 获取查询参数
    const { image_ids, include_images = 'true', format = 'yolo' } = req.query;

    // 验证格式参数
    const validFormats = ['yolo', 'coco'];
    if (!validFormats.includes(format.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Invalid format. Use yolo or coco.' });
    }

    // 解析image_ids参数
    let imageIds = [];
    if (image_ids) {
      imageIds = image_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    console.log('Parsed image IDs:', imageIds);
    console.log('Export format:', format);

    // 检查archiver依赖是否安装
    let archiver;
    try {
      archiver = require('archiver');
    } catch (err) {
      console.error('Archiver dependency not found:', err);
      return res.status(500).json({ success: false, error: 'Archiver dependency not installed' });
    }

    // 创建导出目录
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // 生成临时ZIP文件路径
    const zipFilename = `${format}-export_${Date.now()}.zip`;
    const zipPath = path.join(exportsDir, zipFilename);

    console.log('Creating ZIP file at:', zipPath);

    // 创建可写流
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // 设置事件监听器
    output.on('close', () => {
      console.log('ZIP file created successfully');
      console.log('Total bytes:', archive.pointer());

      // 将ZIP文件发送给客户端
      res.download(zipPath, zipFilename, (err) => {
        if (err) {
          console.error('Error sending ZIP file:', err);
        }

        // 删除临时文件
        fs.unlink(zipPath, (err) => {
          if (err) {
            console.error('Error deleting temporary ZIP file:', err);
          }
        });
      });
    });

    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      throw err;
    });

    // 管道连接
    archive.pipe(output);

    // 查询图像数据
    let images;
    try {
      const queryOptions = {
        include: [{
          model: Annotation
        }]
      };

      if (imageIds.length > 0) {
        queryOptions.where = { image_id: imageIds };
      }

      console.log('Database query options:', queryOptions);

      // 获取图像数据
      images = await Image.findAll(queryOptions);
      console.log('Found images:', images.length);

    } catch (dbErr) {
      console.error('Database query error:', dbErr);
      // 如果数据库查询失败，返回一个简单的JSON响应
      return res.json({
        success: true,
        message: `${format.toUpperCase()} export test successful`,
        timestamp: new Date().toISOString(),
        received_params: req.query,
        images_found: 0,
        error: 'Database query failed: ' + dbErr.message
      });
    }

    // 根据选择的格式处理导出
    if (format.toLowerCase() === 'yolo') {
      // 处理每个图像（YOLO格式）
      for (const image of images) {
        console.log('Processing image:', image.image_id, image.filename);

        // 获取图像数据和标注
        const imageData = image.toJSON();
        const annotations = imageData.Annotations || [];

        console.log('Image data:', JSON.stringify(imageData, null, 2));
        console.log('Annotations:', annotations.length);

        // 使用正确的图像尺寸字段名
        const imgWidth = imageData.image_width;
        const imgHeight = imageData.image_height;

        // 生成YOLO标签
        const labelContent = generateYoloLabel(annotations, imgWidth, imgHeight);
        console.log('Label content:', labelContent);

        // 使用正确的文件名（从file_path提取）
        const actualFilename = path.basename(imageData.file_path);
        const labelFilename = path.basename(actualFilename, path.extname(actualFilename)) + '.txt';

        // 将标签文件添加到ZIP
        archive.append(labelContent, { name: labelFilename });

        // 如果需要包含图像文件
        if (include_images === 'true') {
          const imagePath = path.join(__dirname, '../', imageData.file_path);
          if (fs.existsSync(imagePath)) {
            archive.file(imagePath, { name: actualFilename });
          } else {
            console.warn('Image file not found:', imagePath);
          }
        }
      }
    } else if (format.toLowerCase() === 'coco') {
      // 生成COCO格式数据
      const cocoData = generateCocoData(images);
      const cocoContent = JSON.stringify(cocoData, null, 2);

      // 将COCO JSON文件添加到ZIP
      archive.append(cocoContent, { name: 'annotations.json' });

      // 如果需要包含图像文件
      if (include_images === 'true') {
        for (const image of images) {
          const imageData = image.toJSON();
          const actualFilename = path.basename(imageData.file_path);
          const imagePath = path.join(__dirname, '../', imageData.file_path);

          if (fs.existsSync(imagePath)) {
            archive.file(imagePath, { name: actualFilename });
          } else {
            console.warn('Image file not found:', imagePath);
          }
        }
      }
    }

    // 完成ZIP归档
    await archive.finalize();

  } catch (err) {
    console.error('=== Export ERROR DETAILS ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Error name:', err.name);
    console.error('Error code:', err.code);

    // 返回JSON格式的错误响应
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
      name: err.name
    });
  }
});

// 添加一个不使用认证中间件的测试路由
router.get('/test', async (req, res) => {
  try {
    console.log('=== Test route request received ===');
    console.log('Query params:', req.query);

    res.json({
      success: true,
      message: 'Test route works!',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Test route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
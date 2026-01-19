// Utility for exporting annotations in COCO format
const path = require('path');

/**
 * Generate COCO format export data
 * @param {Array} images - List of images with annotations
 * @returns {Object} COCO format export data
 */
const generateCocoData = (images) => {
    // COCO格式基本结构
    const cocoData = {
        info: {
            year: new Date().getFullYear(),
            version: '1.0',
            description: 'Annotations exported from Spruce Detection System',
            contributor: 'Spruce Detection Team',
            url: '',
            date_created: new Date().toISOString()
        },
        licenses: [
            {
                id: 1,
                name: 'CC BY 4.0',
                url: 'https://creativecommons.org/licenses/by/4.0/'
            }
        ],
        images: [],
        annotations: [],
        categories: [
            {
                id: 1,
                name: 'dead_spruce',
                supercategory: 'tree'
            }
        ]
    };

    // 处理每个图像
    images.forEach((image, imageIndex) => {
        const imageData = image.toJSON();
        const annotations = imageData.Annotations || [];

        // 添加图像信息
        cocoData.images.push({
            id: imageData.image_id,
            width: imageData.image_width,
            height: imageData.image_height,
            file_name: path.basename(imageData.file_path),
            license: 1,
            flickr_url: '',
            coco_url: '',
            date_captured: imageData.upload_time || new Date().toISOString()
        });

        // 处理每个标注
        annotations.forEach((annotation, annoIndex) => {
            // COCO格式要求的标注结构
            cocoData.annotations.push({
                id: imageData.image_id * 1000 + annoIndex + 1, // 唯一标注ID
                image_id: imageData.image_id,
                category_id: annotation.label_class || 1, // 默认类别为1
                bbox: [
                    annotation.x, // x坐标
                    annotation.y, // y坐标
                    annotation.width, // 宽度
                    annotation.height // 高度
                ],
                area: annotation.width * annotation.height, // 面积
                segmentation: [], // 简单边界框的分割信息为空
                iscrowd: 0 // 非人群
            });
        });
    });

    return cocoData;
};

module.exports = {
    generateCocoData
};
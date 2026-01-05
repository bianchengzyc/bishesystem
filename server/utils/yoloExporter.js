// Utility for exporting annotations in YOLO format

/**
 * Convert pixel coordinates to YOLO normalized coordinates
 * @param {Object} annotation - Annotation object with x, y, width, height
 * @param {number} imgWidth - Image width in pixels
 * @param {number} imgHeight - Image height in pixels
 * @returns {Object} YOLO normalized coordinates {x_center, y_center, w_norm, h_norm}
 */
const convertToYoloFormat = (annotation, imgWidth, imgHeight) => {
  const x_center = (annotation.x + annotation.width / 2) / imgWidth;
  const y_center = (annotation.y + annotation.height / 2) / imgHeight;
  const w_norm = annotation.width / imgWidth;
  const h_norm = annotation.height / imgHeight;
  
  return {
    x_center,
    y_center,
    w_norm,
    h_norm
  };
};

/**
 * Generate YOLO label file content
 * @param {Array} annotations - List of annotations for an image
 * @param {number} imgWidth - Image width
 * @param {number} imgHeight - Image height
 * @returns {string} YOLO format label content
 */
const generateYoloLabel = (annotations, imgWidth, imgHeight) => {
  return annotations
    .map(annotation => {
      const yoloCoords = convertToYoloFormat(annotation, imgWidth, imgHeight);
      // YOLO format: <class_id> <x_center> <y_center> <width> <height>
      return `${annotation.label_class} ${yoloCoords.x_center.toFixed(6)} ${yoloCoords.y_center.toFixed(6)} ${yoloCoords.w_norm.toFixed(6)} ${yoloCoords.h_norm.toFixed(6)}`;
    })
    .join('\n');
};

module.exports = {
  convertToYoloFormat,
  generateYoloLabel
};
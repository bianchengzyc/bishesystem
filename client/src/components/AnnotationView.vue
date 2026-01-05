<template>
  <div class="annotation-container">
    <div class="header">
      <h2>单株枯死云杉高精度检测数据系统图像标注</h2>
      <el-button type="primary" @click="saveAnnotations">保存标注</el-button>
      <el-button @click="goBack">返回列表</el-button>
    </div>

    <div class="main-content">
      <div class="image-section">
        <div class="annotation-canvas" ref="canvasContainer" @dragstart.prevent @drag.prevent>
          <img
            ref="imageRef"
            :src="imageUrl"
            :alt="image.file_name"
            draggable="false"
            @load="onImageLoad"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @dragstart.prevent
            @drag.prevent
            @contextmenu.prevent
          />
          <div
            v-for="(annotation, index) in annotations"
            :key="annotation.annotation_id || index"
            class="bounding-box"
            :style="{
              left: `${annotation.x}px`,
              top: `${annotation.y}px`,
              width: `${annotation.width}px`,
              height: `${annotation.height}px`,
              border: selectedAnnotationId === annotation.annotation_id ? '2px solid #409EFF' : '2px solid #F56C6C',
              cursor: 'move'
            }"
            @mousedown.stop="selectAnnotation(annotation, $event)"
          >
            <div class="bbox-label">枯死云杉</div>
            <div class="bbox-controls">
              <span class="bbox-delete" @click.stop="deleteAnnotation(index)">×</span>
            </div>
          </div>
          
          <!-- 临时绘制的边界框 -->
          <div
            v-if="isDragging"
            class="bounding-box temp"
            :style="{
              left: `${tempBbox.x}px`,
              top: `${tempBbox.y}px`,
              width: `${tempBbox.width}px`,
              height: `${tempBbox.height}px`
            }"
          ></div>
        </div>
      </div>

      <div class="info-section">
        <div class="image-info">
          <h3>图像信息</h3>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="图像名称">{{ image.file_name }}</el-descriptions-item>
            <el-descriptions-item label="图像尺寸">{{ image.image_width }} × {{ image.image_height }} 像素</el-descriptions-item>
            <el-descriptions-item label="上传时间">{{ image.upload_time }}</el-descriptions-item>
            <el-descriptions-item label="标注数量">{{ annotations.length }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="annotation-tools">
          <h3>标注工具</h3>
          <el-button
            type="primary"
            :disabled="!isDrawingEnabled"
            @click="toggleDrawingMode"
          >
            {{ isDrawing ? '停止绘制' : '开始绘制边界框' }}
          </el-button>
          
          <el-divider />
          
          <div class="annotation-list">
            <h4>当前标注列表</h4>
            <el-empty v-if="annotations.length === 0" description="暂无标注" />
            <div v-else class="annotation-items">
              <div
                v-for="(annotation, index) in annotations"
                :key="annotation.annotation_id || index"
                class="annotation-item"
                :class="{ active: selectedAnnotationId === annotation.annotation_id }"
                @click="selectAnnotation(annotation)"
              >
                <span class="annotation-index">{{ index + 1 }}</span>
                <span class="annotation-coords">
                  X: {{ annotation.x }}, Y: {{ annotation.y }}, W: {{ annotation.width }}, H: {{ annotation.height }}
                </span>
                <el-button
                  type="danger"
                  size="small"
                  icon="Delete"
                  @click.stop="deleteAnnotation(index)"
                ></el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../store/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const token = computed(() => authStore.token)

const canvasContainer = ref(null)
const imageRef = ref(null)
const image = ref({})
const annotations = ref([])
const isDrawing = ref(false)
const isDrawingEnabled = ref(true)
const selectedAnnotationId = ref(null)
const currentAnnotation = ref(null)
const startPoint = ref({ x: 0, y: 0 })
const tempBbox = ref({ x: 0, y: 0, width: 0, height: 0 })
const isDragging = ref(false) // 新的状态：是否正在拖拽

const imageId = computed(() => route.params.id)
const imageUrl = computed(() => {
  // 从完整路径中提取文件名
  if (!image.value.file_path) return ''
  
  // 处理Windows路径分隔符和Unix路径分隔符
  const normalizedPath = image.value.file_path.replace(/\\/g, '/')
  const filename = normalizedPath.split('/').pop()
  
  // 使用静态文件服务直接访问图片
  return `/uploads/images/${filename}`
})

const toggleDrawingMode = () => {
  if (isDrawing.value) {
    // 停止绘制模式
    isDrawing.value = false
    isDrawingEnabled.value = false
    currentAnnotation.value = null
    isDragging.value = false
    resetDrawingState()
  } else {
    // 进入绘制模式
    isDrawing.value = true
    isDrawingEnabled.value = true // 允许开始绘制
    selectedAnnotationId.value = null
    isDragging.value = false
    resetDrawingState()
  }
}

const onImageLoad = () => {
  if (imageRef.value) {
    console.log('Image loaded:', imageRef.value.width, 'x', imageRef.value.height)
  }
}

const startDrawing = (e) => {
  // 阻止浏览器默认行为
  e.preventDefault()
  e.stopPropagation()
  
  // 只有在绘制模式中并且允许绘制时才响应
  if (!isDrawing.value || !isDrawingEnabled.value) return
  
  // 确保点击的是图片而不是已存在的边界框
  if (e.target !== imageRef.value) return
  
  const rect = canvasContainer.value.getBoundingClientRect()
  startPoint.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  
  // 重置临时边界框
  tempBbox.value = { x: startPoint.value.x, y: startPoint.value.y, width: 0, height: 0 }
  
  // 开始拖拽状态
  isDragging.value = true
  
  // 添加全局鼠标事件监听器
  document.addEventListener('mousemove', draw)
  document.addEventListener('mouseup', stopDrawing)
  
  // 设置为正在绘制状态（禁用新的开始绘制）
  isDrawingEnabled.value = false
}

const draw = (e) => {
  // 只有在绘制模式中且已经开始绘制时才响应（isDrawingEnabled.value === false表示已开始绘制）
  if (!isDrawing.value || isDrawingEnabled.value) return
  
  e.preventDefault()
  
  const rect = canvasContainer.value.getBoundingClientRect()
  let currentX = e.clientX - rect.left
  let currentY = e.clientY - rect.top
  
  // 获取图片的实际尺寸
  const imgWidth = imageRef.value ? imageRef.value.width : 0
  const imgHeight = imageRef.value ? imageRef.value.height : 0
  
  // 计算边界框的最终位置和尺寸
  let bboxX = Math.min(startPoint.value.x, currentX)
  let bboxY = Math.min(startPoint.value.y, currentY)
  let bboxWidth = Math.abs(currentX - startPoint.value.x)
  let bboxHeight = Math.abs(currentY - startPoint.value.y)
  
  // 边界检查：确保边界框不超出图片范围
  bboxX = Math.max(0, Math.min(bboxX, imgWidth))
  bboxY = Math.max(0, Math.min(bboxY, imgHeight))
  
  // 确保边界框的右下角不超出图片
  const maxWidth = imgWidth - bboxX
  const maxHeight = imgHeight - bboxY
  bboxWidth = Math.min(bboxWidth, maxWidth)
  bboxHeight = Math.min(bboxHeight, maxHeight)
  
  tempBbox.value = {
    x: bboxX,
    y: bboxY,
    width: bboxWidth,
    height: bboxHeight
  }
}

const stopDrawing = () => {
  // 只有在拖拽状态时才响应
  if (!isDragging.value) return
  
  // 移除全局鼠标事件监听器
  document.removeEventListener('mousemove', draw)
  document.removeEventListener('mouseup', stopDrawing)
  
  // 只有在真正有拖拽移动时才检查大小
  const hasMoved = tempBbox.value.width > 0 || tempBbox.value.height > 0
  if (!hasMoved) {
    // 没有拖拽，只是点击，取消绘制
    resetDrawingState()
    return
  }
  
  // 最小边界框大小检查
  if (tempBbox.value.width < 10 || tempBbox.value.height < 10) {
    ElMessage.warning('边界框太小，请重新绘制')
    resetDrawingState()
    return
  }
  
  // 获取图片尺寸进行最终边界检查
  const imgWidth = imageRef.value ? imageRef.value.width : 0
  const imgHeight = imageRef.value ? imageRef.value.height : 0
  
  // 最终边界检查
  if (tempBbox.value.x + tempBbox.value.width > imgWidth ||
      tempBbox.value.y + tempBbox.value.height > imgHeight ||
      tempBbox.value.x < 0 || tempBbox.value.y < 0) {
    ElMessage.warning('边界框超出图片范围，请重新绘制')
    resetDrawingState()
    return
  }
  
  // 添加新标注
  annotations.value.push({
    ...tempBbox.value,
    image_id: image.value.image_id,
    label_class: 0 // 0=枯死云杉
  })
  
  ElMessage.success('标注已添加')
  resetDrawingState()
}

const resetDrawingState = () => {
  // 重置绘制状态
  tempBbox.value = { x: 0, y: 0, width: 0, height: 0 }
  startPoint.value = { x: 0, y: 0 }
  isDragging.value = false
  isDrawingEnabled.value = true
}

const selectAnnotation = (annotation, event = null) => {
  if (isDrawing.value) return
  
  selectedAnnotationId.value = annotation.annotation_id
  currentAnnotation.value = annotation
  
  if (event) {
    // 支持拖动
    event.preventDefault()
    const rect = canvasContainer.value.getBoundingClientRect()
    const startX = event.clientX - rect.left - annotation.x
    const startY = event.clientY - rect.top - annotation.y
    
    const handleMouseMove = (e) => {
      const newX = e.clientX - rect.left - startX
      const newY = e.clientY - rect.top - startY
      
      annotation.x = Math.max(0, newX)
      annotation.y = Math.max(0, newY)
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
}

const deleteAnnotation = (index) => {
  ElMessageBox.confirm('确定要删除这个标注吗？', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    annotations.value.splice(index, 1)
    if (selectedAnnotationId.value === annotations[index]?.annotation_id) {
      selectedAnnotationId.value = null
    }
    ElMessage.success('删除成功')
  }).catch(() => {
    // 取消删除
  })
}

const saveAnnotations = async () => {
  try {
    const response = await fetch(`/api/annotations/${image.value.image_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({ annotations: annotations.value })
    })
    
    if (response.ok) {
      const data = await response.json()
      annotations.value = data.annotations
      ElMessage.success('标注保存成功')
    } else {
      throw new Error('保存失败')
    }
  } catch (error) {
    console.error('Error saving annotations:', error)
    ElMessage.error('保存失败，请重试')
  }
}

const loadImageData = async () => {
  try {
    // 从路由参数获取图像数据或从API加载
    if (route.query.image) {
      image.value = JSON.parse(route.query.image)
    } else {
      const response = await fetch(`/api/images/${imageId.value}`, {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      })
      if (response.ok) {
        image.value = await response.json()
      } else {
        throw new Error('获取图像数据失败')
      }
    }
    
    // 加载标注数据
    const annotationsResponse = await fetch(`/api/annotations/image/${image.value.image_id}`, {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })
    
    if (annotationsResponse.ok) {
      const data = await annotationsResponse.json()
      annotations.value = data.annotations || []
    }
  } catch (error) {
    console.error('Error loading image data:', error)
    ElMessage.error('加载图像数据失败')
    goBack()
  }
}

const goBack = () => {
  router.push('/images')
}

onMounted(() => {
  if (!token.value) {
    router.push('/login')
    return
  }
  loadImageData()
})
</script>

<style scoped>
.annotation-container {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  color: #333;
}

.main-content {
  display: flex;
  gap: 20px;
}

.image-section {
  flex: 1;
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
}

.annotation-canvas {
  position: relative;
  display: inline-block;
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: auto;
  max-height: 70vh;
}

.annotation-canvas img {
   user-select: none;
   -webkit-user-select: none;
   -moz-user-select: none;
   -ms-user-select: none;
   -webkit-user-drag: none;
   -khtml-user-drag: none;
   -moz-user-drag: none;
   -o-user-drag: none;
   user-drag: none;
   pointer-events: auto;
   display: block;
   max-width: 100%;
  height: auto;
  cursor: crosshair;
}

.bounding-box {
  position: absolute;
  box-sizing: border-box;
  pointer-events: all;
}

.bounding-box.temp {
  background-color: rgba(245, 108, 108, 0.2);
  border: 2px dashed #F56C6C;
}

.bbox-label {
  position: absolute;
  top: -25px;
  left: 0;
  background-color: #F56C6C;
  color: white;
  padding: 2px 6px;
  font-size: 12px;
  border-radius: 3px;
}

.bbox-controls {
  position: absolute;
  bottom: -20px;
  right: 0;
}

.bbox-delete {
  display: inline-block;
  width: 18px;
  height: 18px;
  background-color: #F56C6C;
  color: white;
  border-radius: 50%;
  text-align: center;
  line-height: 16px;
  cursor: pointer;
  font-size: 14px;
}

.bbox-delete:hover {
  background-color: #F78989;
}

.info-section {
  width: 350px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.image-info, .annotation-tools {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.annotation-list {
  margin-top: 20px;
}

.annotation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.annotation-item:hover {
  background-color: #e9e9e9;
}

.annotation-item.active {
  background-color: #ecf5ff;
  border-left: 3px solid #409EFF;
}

.annotation-index {
  width: 24px;
  height: 24px;
  background-color: #409EFF;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.annotation-coords {
  flex: 1;
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.go-back-button {
  margin-top: 20px;
}
</style>
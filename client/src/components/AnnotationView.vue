<template>
  <div class="annotation-container">
    <div class="header">
      <h2>单株枯死云杉高精度检测数据系统图像标注</h2>
      <el-button type="primary" @click="saveAnnotations">保存标注</el-button>
      <el-button @click="goBack">返回列表</el-button>
    </div>

    <div class="main-content">
      <div class="left-section">
        <div class="image-section">
          <div class="section-title">图像标注</div>
          <div class="image-tools-container">
            <!-- 图像显示区域 -->
            <div class="annotation-canvas-container">
              <div class="annotation-canvas" ref="canvasContainer" @dragstart.prevent @drag.prevent>
                <!-- 多波段图像显示 -->
                <canvas 
                  ref="imageCanvas" 
                  width="800" 
                  height="600"
                  @load="onImageLoad"
                  @mousedown="startDrawing"
                  @mousemove="draw"
                  @mouseup="stopDrawing"
                  @dragstart.prevent
                  @drag.prevent
                  @contextmenu.prevent
                ></canvas>
                
                <!-- 传统图像显示作为备选 -->
                <img
                  v-if="!isGeoTiff"
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
                 <!-- <div class="bbox-label">枯死云杉</div>  -->
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
          
          <!-- 标注工具和波段选择区域 -->
          <div class="tools-sidebar">
            <div class="annotation-tools">
              <h3>标注工具</h3>
                <el-button
                  type="primary"
                  :disabled="!isDrawingEnabled"
                  @click="toggleDrawingMode"
                >
                  {{ isDrawing ? '停止绘制' : '开始绘制边界框' }}
                </el-button>
                
                <!-- 波段选择工具 -->
                <div v-if="isGeoTiff && availableBands.length > 0" class="band-selection">
                  <h4>波段选择</h4>
                  <el-select 
                    v-model="selectedBands.r" 
                    placeholder="选择红波段"
                    class="band-select"
                    @change="updateImageDisplay"
                  >
                    <el-option 
                      v-for="band in availableBands" 
                      :key="band"
                      :label="`波段 ${band}`" 
                      :value="band"
                    />
                  </el-select>
                  <el-select 
                    v-model="selectedBands.g" 
                    placeholder="选择绿波段"
                    class="band-select"
                    @change="updateImageDisplay"
                  >
                    <el-option 
                      v-for="band in availableBands" 
                      :key="band"
                      :label="`波段 ${band}`" 
                      :value="band"
                    />
                  </el-select>
                  <el-select 
                    v-model="selectedBands.b" 
                    placeholder="选择蓝波段"
                    class="band-select"
                    @change="updateImageDisplay"
                  >
                    <el-option 
                      v-for="band in availableBands" 
                      :key="band"
                      :label="`波段 ${band}`" 
                      :value="band"
                    />
                  </el-select>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 地图区域 - 放置在图像旁边 -->
        <div class="map-section">
          <h3>图像位置</h3>
          <div id="map" ref="mapRef" class="map-container"></div>
        </div>
      </div>
      
      <!-- 信息区域 -->
      <div class="right-section">
        <div class="info-section">
          <div class="image-info">
            <h3>图像信息</h3>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="图像名称">{{ image.file_name }}</el-descriptions-item>
              <el-descriptions-item label="图像尺寸">{{ image.image_width }} × {{ image.image_height }} 像素</el-descriptions-item>
              <el-descriptions-item label="上传时间">{{ image.upload_time }}</el-descriptions-item>
              <el-descriptions-item label="标注数量">{{ annotations.length }}</el-descriptions-item>
              <el-descriptions-item v-if="imageBounds" label="左上角经纬度">{{ formatCoordinate(imageBounds.minX, imageBounds.minY) }}</el-descriptions-item>
              <el-descriptions-item v-if="imageBounds" label="右下角经纬度">{{ formatCoordinate(imageBounds.maxX, imageBounds.maxY) }}</el-descriptions-item>
            </el-descriptions>
          </div>
          
          <!-- 标注列表 -->
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
                <span class="annotation-coords"> X: {{ annotation.x }}, Y: {{ annotation.y }}, W: {{ annotation.width }}, H: {{ annotation.height }}</span>
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
import { fromUrl } from 'geotiff'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css' // 添加Leaflet CSS样式导入
import proj4 from 'proj4'

// 定义常用坐标系
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs')
proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs')
proj4.defs('EPSG:32650', '+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs')
proj4.defs('EPSG:32649', '+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs')
proj4.defs('EPSG:32632', '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs')
// 添加德国常用的EPSG:25832坐标系
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')

// 默认使用WGS84坐标系
const defaultProjection = 'EPSG:4326'
// 默认的源投影（德国常用的EPSG:25832）
const defaultSourceProjection = 'EPSG:25832'

// 坐标转换函数：将给定投影的坐标转换为WGS84
const convertToWGS84 = (x, y, sourceProjection = null) => {
  try {
    // 如果未指定源投影，使用默认的EPSG:25832（德国常用）
    if (!sourceProjection) {
      sourceProjection = defaultSourceProjection;
      console.log('使用默认源投影:', sourceProjection);
    }
    
    // 执行坐标转换
    const transformed = proj4(sourceProjection, defaultProjection, [x, y]);
    console.log(`坐标转换成功: ${sourceProjection} -> ${defaultProjection}`);
    console.log('原始坐标:', x, y);
    console.log('转换后坐标:', transformed[0], transformed[1]);
    return { lon: transformed[0], lat: transformed[1] };
  } catch (error) {
    console.error('坐标转换失败:', error);
    // 转换失败时，尝试其他可能的德国投影
    try {
      const germanProjections = ['EPSG:32632', 'EPSG:32633', 'EPSG:32631'];
      for (const proj of germanProjections) {
        try {
          const transformed = proj4(proj, defaultProjection, [x, y]);
          console.log(`使用备选投影${proj}转换成功:`, transformed);
          return { lon: transformed[0], lat: transformed[1] };
        } catch (e) {
          continue;
        }
      }
      // 最终失败时返回原始坐标
      return { lon: x, lat: y };
    } catch (e) {
      console.error('所有转换尝试都失败:', e);
      return { lon: x, lat: y };
    }
  }
}

// 转换整个边界框到WGS84
const convertBoundsToWGS84 = (bounds, sourceProjection = null) => {
  if (!bounds) return null
  
  try {
    const minConverted = convertToWGS84(bounds.minX, bounds.minY, sourceProjection)
    const maxConverted = convertToWGS84(bounds.maxX, bounds.maxY, sourceProjection)
    
    return {
      minX: minConverted.lon,
      minY: minConverted.lat,
      maxX: maxConverted.lon,
      maxY: maxConverted.lat
    }
  } catch (error) {
    console.error('边界框转换失败:', error)
    return bounds
  }
}

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const token = computed(() => authStore.token)

const canvasContainer = ref(null)
const imageRef = ref(null)
const imageCanvas = ref(null)
const image = ref({})
const annotations = ref([])
const isDrawing = ref(false)
const isDrawingEnabled = ref(true)
const selectedAnnotationId = ref(null)
const currentAnnotation = ref(null)
const startPoint = ref({ x: 0, y: 0 })
const tempBbox = ref({ x: 0, y: 0, width: 0, height: 0 })
const isDragging = ref(false) // 新的状态：是否正在拖拽

// 多波段图像相关
const isGeoTiff = ref(false)
const availableBands = ref([])
const selectedBands = ref({ r: 1, g: 2, b: 3 })
const tiffData = ref(null)
const imageData = ref(null)

// 地图相关
const mapRef = ref(null)
const imageBounds = ref(null)
let mapInstance = null

// 格式化坐标显示
const formatCoordinate = (lon, lat) => {
  if (!lon || !lat) return 'N/A'
  return `${lon.toFixed(6)}, ${lat.toFixed(6)}`
}

// 初始化地图
const initMap = () => {
  console.log('开始初始化地图...')
  // 确保DOM已完全加载
  if (!mapRef.value) {
    console.error('地图容器未找到');
    ElMessage.error('地图容器未找到，无法初始化地图');
    return;
  }
  
  console.log('地图容器:', mapRef.value)
  
  // 强制设置地图容器的高度（解决初始高度计算问题）
  mapRef.value.style.height = '250px';
  console.log('地图容器尺寸:', mapRef.value.offsetWidth, 'x', mapRef.value.offsetHeight)
  
  try {
    // 创建地图实例，使用默认中心点和缩放级别
    mapInstance = L.map(mapRef.value, {
      center: [45.0, 120.0], // 默认中心点（中国东北地区）
      zoom: 8,               // 默认缩放级别
      zoomControl: true,
      attributionControl: true
    })
    
    console.log('地图实例创建成功:', mapInstance)
    
    // 修复Leaflet默认图标路径问题
    L.Marker.prototype.options.icon = L.icon({
      iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><circle cx="128" cy="128" r="120" fill="%23409EFF" opacity="0.5"/><circle cx="128" cy="128" r="80" fill="%23409EFF"/><circle cx="128" cy="128" r="40" fill="white"/></svg>',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    
    // 添加高德地图图层（国内可用）
    console.log('添加高德地图图层...')
    const tileLayer = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      attribution: '© <a href="https://www.amap.com/">高德地图</a>',
      maxZoom: 19,
      errorTileUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="%23f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="%23999">加载失败</text></svg>'
    });
    
    // 添加瓦片加载错误处理
    tileLayer.on('tileerror', function(err) {
      console.error('瓦片加载失败:', err);
    });
    
    tileLayer.on('load', function() {
      console.log('瓦片图层加载完成');
    });
    
    tileLayer.addTo(mapInstance);
    console.log('高德地图图层添加成功')
    
    // 如果有地理边界数据，添加边界矩形并自动缩放
    console.log('当前地理边界:', imageBounds.value)
    if (imageBounds.value) {
      try {
        console.log('添加图像边界矩形...')
        // 验证地理边界数据是否有效
        const isValidBounds = imageBounds.value.minX && imageBounds.value.minY && 
                              imageBounds.value.maxX && imageBounds.value.maxY &&
                              imageBounds.value.minX < imageBounds.value.maxX &&
                              imageBounds.value.minY < imageBounds.value.maxY;
        
        if (isValidBounds) {
          // 添加图像边界矩形
          const rectangle = L.rectangle([
            [imageBounds.value.minY, imageBounds.value.minX],
            [imageBounds.value.maxY, imageBounds.value.maxX]
          ], {
            color: '#409EFF',
            weight: 2,
            fillColor: '#409EFF',
            fillOpacity: 0.3
          }).addTo(mapInstance);
          
          console.log('边界矩形添加成功:', rectangle)
          
          // 自动缩放地图以适应图像边界
          console.log('自动缩放地图到边界...')
          mapInstance.fitBounds([
            [imageBounds.value.minY, imageBounds.value.minX],
            [imageBounds.value.maxY, imageBounds.value.maxX]
          ], { padding: [20, 20] });
          
          console.log('地图缩放完成')
        } else {
          console.error('无效的地理边界数据:', imageBounds.value)
          ElMessage.warning('地理边界数据无效，使用默认视图');
        }
      } catch (error) {
        console.error('地图边界设置错误:', error);
        ElMessage.warning('无法设置地图边界，使用默认视图');
      }
    } else {
      console.warn('没有地理边界数据，使用默认地图视图');
      ElMessage.info('当前图像没有地理信息，显示默认地图视图');
      
      // 添加一个标记到默认中心点，验证地图功能
      const marker = L.marker([45.0, 120.0]).addTo(mapInstance);
      marker.bindPopup('默认中心点').openPopup();
    }
    
    console.log('地图初始化完成')
  } catch (error) {
    console.error('地图初始化失败:', error);
    ElMessage.error('地图初始化失败: ' + error.message);
  }
}

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
  if (isGeoTiff.value) {
    console.log('GeoTIFF image loaded:', imageCanvas.value.width, 'x', imageCanvas.value.height)
    return
  }
  
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
  
  // 确保点击的是图片（支持canvas和img两种显示方式）
  if (isGeoTiff.value) {
    if (e.target !== imageCanvas.value) return
  } else {
    if (e.target !== imageRef.value) return
  }
  
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
  
  // 获取图片的实际尺寸（支持canvas和img两种显示方式）
  let imgWidth, imgHeight
  if (isGeoTiff.value && imageCanvas.value) {
    imgWidth = imageCanvas.value.width
    imgHeight = imageCanvas.value.height
  } else if (imageRef.value) {
    imgWidth = imageRef.value.width
    imgHeight = imageRef.value.height
  } else {
    return
  }
  
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
  let imgWidth, imgHeight
  if (isGeoTiff.value && imageCanvas.value) {
    imgWidth = imageCanvas.value.width
    imgHeight = imageCanvas.value.height
  } else if (imageRef.value) {
    imgWidth = imageRef.value.width
    imgHeight = imageRef.value.height
  } else {
    resetDrawingState()
    return
  }
  
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
    
    console.log('图像数据:', image.value)
    
    // 检查API返回的图像数据是否包含地理边界信息
    if (image.value.bounds || image.value.geometry) {
      // 处理API返回的地理边界数据
      console.log('API返回的地理边界数据:', image.value.bounds || image.value.geometry)
      if (image.value.bounds) {
        let bounds = {
          minX: image.value.bounds.minX,
          minY: image.value.bounds.minY,
          maxX: image.value.bounds.maxX,
          maxY: image.value.bounds.maxY
        }
        // 转换边界到WGS84坐标系
        imageBounds.value = convertBoundsToWGS84(bounds)
        console.log('转换后的API地理边界:', imageBounds.value)
      } else if (image.value.geometry) {
        // 处理几何数据格式（如果有的话）
        try {
          const geom = JSON.parse(image.value.geometry)
          if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates.length > 0) {
            // 计算边界框
            const coords = geom.coordinates[0]
            let minX = Infinity, minY = Infinity
            let maxX = -Infinity, maxY = -Infinity
            
            coords.forEach(coord => {
              minX = Math.min(minX, coord[0])
              minY = Math.min(minY, coord[1])
              maxX = Math.max(maxX, coord[0])
              maxY = Math.max(maxY, coord[1])
            })
            
            let bounds = {
              minX, minY, maxX, maxY
            }
            // 转换边界到WGS84坐标系
            imageBounds.value = convertBoundsToWGS84(bounds)
            console.log('转换后的几何边界:', imageBounds.value)
          }
        } catch (e) {
          console.error('解析几何数据失败:', e)
        }
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
    
    // 检查是否为TIFF文件，如果是则尝试以多波段模式加载
    if (image.value.file_name && (image.value.file_name.toLowerCase().endsWith('.tif') || image.value.file_name.toLowerCase().endsWith('.tiff'))) {
      await loadGeoTiffImage()
    }
    
    console.log('最终地理边界:', imageBounds.value)
    
    // 延迟初始化地图，确保DOM已经渲染完成
    setTimeout(() => {
      initMap()
    }, 100)
    
  } catch (error) {
    console.error('Error loading image data:', error)
    ElMessage.error('加载图像数据失败')
    goBack()
  }
}

const goBack = () => {
  router.push('/images')
}

// 加载多波段TIFF图像
const loadGeoTiffImage = async () => {
  try {
    const url = imageUrl.value
    console.log('加载GeoTIFF图像:', url)
    const tiff = await fromUrl(url)
    tiffData.value = tiff
    
    // 获取第一个图像来检测波段数量和地理信息
    const firstImage = await tiff.getImage(0)
    console.log('GeoTIFF图像信息:', {
      width: firstImage.getWidth(),
      height: firstImage.getHeight(),
      samplesPerPixel: firstImage.getSamplesPerPixel()
    })
    
    // 获取样本数（波段数量）
    const samplesPerPixel = firstImage.getSamplesPerPixel()
    availableBands.value = Array.from({ length: samplesPerPixel }, (_, i) => i + 1)
    
    // 默认选择前三个波段
    if (availableBands.value.length >= 3) {
      selectedBands.value = { r: 1, g: 2, b: 3 }
    } else if (availableBands.value.length >= 1) {
      selectedBands.value = { r: 1, g: 1, b: 1 }
    }
    
    // 获取地理边界
    console.log('尝试获取GeoTIFF地理边界...')
    try {
      const bbox = firstImage.getBoundingBox()
      console.log('GeoTIFF边界框:', bbox)
      if (bbox && bbox.length === 4) {
        let bounds = {
          minX: bbox[0], // 西经
          minY: bbox[1], // 南纬
          maxX: bbox[2], // 东经
          maxY: bbox[3]  // 北纬
        }
        console.log('原始GeoTIFF地理边界:', bounds)
        // 转换边界到WGS84坐标系
        imageBounds.value = convertBoundsToWGS84(bounds)
        console.log('转换后的GeoTIFF地理边界:', imageBounds.value)
        
        // 验证地理边界数据
        const isValid = imageBounds.value.minX < imageBounds.value.maxX && 
                       imageBounds.value.minY < imageBounds.value.maxY &&
                       imageBounds.value.minX !== imageBounds.value.maxX &&
                       imageBounds.value.minY !== imageBounds.value.maxY;
        
        if (!isValid) {
          console.error('转换后的边界无效:', imageBounds.value)
          imageBounds.value = null;
        }
      } else {
        console.error('GeoTIFF边界框格式错误或为空:', bbox)
      }
    } catch (error) {
      console.error('获取GeoTIFF地理边界失败:', error)
      // 尝试其他方式获取地理信息
      const geoKeys = firstImage.getGeoKeys()
      console.log('GeoTIFF地理键:', geoKeys)
      
      // 尝试获取坐标转换信息
      const transformation = firstImage.getTransformation()
      console.log('GeoTIFF坐标转换:', transformation)
    }
    
    isGeoTiff.value = true
    await updateImageDisplay()
    
  } catch (error) {
    console.error('Error loading GeoTIFF:', error)
    isGeoTiff.value = false
    ElMessage.warning('无法以多波段模式加载图像，将使用传统模式显示')
  }
}

// 更新图像显示（根据选择的波段）
const updateImageDisplay = async () => {
  if (!tiffData.value || !imageCanvas.value) return
  
  try {
    const canvas = imageCanvas.value
    const ctx = canvas.getContext('2d')
    
    // 获取第一个图像（包含所有波段）
    const mainImage = await tiffData.value.getImage(0)
    
    // 获取图像尺寸
    const width = mainImage.getWidth()
    const height = mainImage.getHeight()
    
    // 设置canvas尺寸
    canvas.width = width
    canvas.height = height
    
    // 获取选择的波段索引（从0开始）
    const rBand = selectedBands.value.r - 1
    const gBand = selectedBands.value.g - 1
    const bBand = selectedBands.value.b - 1
    
    // 读取所有波段数据
    const rasterData = await mainImage.readRasters()
    
    // 创建ImageData对象
    const imageData = ctx.createImageData(width, height)
    
    // 归一化并组合三个波段的数据
    // rasterData数组包含每个波段的像素数据
    const rArray = rasterData[rBand]
    const gArray = rasterData[gBand]
    const bArray = rasterData[bBand]
    
    // 找到每个波段的最小值和最大值用于归一化
    const rMin = Math.min(...rArray)
    const rMax = Math.max(...rArray)
    const gMin = Math.min(...gArray)
    const gMax = Math.max(...gArray)
    const bMin = Math.min(...bArray)
    const bMax = Math.max(...bArray)
    
    // 将三个波段的数据组合成RGB图像
    for (let i = 0; i < width * height; i++) {
      // 归一化到0-255范围
      const r = Math.round(((rArray[i] - rMin) / (rMax - rMin)) * 255)
      const g = Math.round(((gArray[i] - gMin) / (gMax - gMin)) * 255)
      const b = Math.round(((bArray[i] - bMin) / (bMax - bMin)) * 255)
      
      // 设置像素值
      imageData.data[i * 4] = r // R
      imageData.data[i * 4 + 1] = g // G
      imageData.data[i * 4 + 2] = b // B
      imageData.data[i * 4 + 3] = 255 // A
    }
    
    // 将图像数据绘制到canvas上
    ctx.putImageData(imageData, 0, 0)
    imageData.value = imageData
    
  } catch (error) {
    console.error('Error updating image display:', error)
    ElMessage.error('更新图像显示失败')
  }
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

/* 图像和工具的容器 */
.image-tools-container {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

/* 图像显示区域 */
.annotation-canvas-container {
  flex: 1;
  min-width: 0;
}

.annotation-canvas {
  position: relative;
  display: inline-block;
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 工具侧边栏 */
.tools-sidebar {
  width: 220px;
  flex-shrink: 0;
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

/* 调整标注工具样式 */
.tools-sidebar .annotation-tools {
  margin: 0;
  padding: 0;
  background: transparent;
}

.tools-sidebar .annotation-tools h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  color: #333;
}

.tools-sidebar .draw-button {
  width: 100%;
  margin-bottom: 15px;
}

/* 调整波段选择样式 */
.tools-sidebar .band-selection {
  margin-top: 0;
  margin-bottom: 15px;
  padding: 10px;
  background-color: white;
  border: 1px solid #e0e0e0;
}

.tools-sidebar .band-selection h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 14px;
  color: #606266;
}

.tools-sidebar .band-select {
  width: 100%;
  margin-right: 0;
  margin-bottom: 10px;
}

/* 调整标注列表样式 */
.annotation-list {
  margin-top: 5px;
  padding: 10px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.annotation-list h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 14px;
  color: #333;
}

.tools-sidebar .annotation-items {
  max-height: 200px;
  overflow-y: auto;
}

.tools-sidebar .annotation-item {
  display: flex;
  align-items: center;
  padding: 8px;
  margin-bottom: 5px;
  background-color: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.tools-sidebar .annotation-item:hover {
  background-color: #e6f7ff;
}

.tools-sidebar .annotation-item.active {
  background-color: #bae7ff;
  border-left: 3px solid #1890ff;
}

.tools-sidebar .annotation-index {
  display: inline-block;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  background-color: #1890ff;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  margin-right: 8px;
}

.tools-sidebar .annotation-coords {
  flex: 1;
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tools-sidebar .annotation-item .el-button {
  margin-left: 5px;
  padding: 4px;
}

.annotation-canvas canvas {
   user-select: none;
   -webkit-user-select: none;
   -moz-user-select: none;
   -ms-user-select: none;
   -webkit-user-drag: none;
   -khtml-user-drag: none;
   -moz-user-drag: none;
   -o-user-drag: none;
   /*user-drag: none; */
   pointer-events: auto;
   display: block;
   max-width: 100%;
   height: auto;
   cursor: crosshair;
}

.band-selection {
  margin-top: 20px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.band-selection h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 14px;
  color: #606266;
}

.band-select {
  width: 100px;
  margin-right: 10px;
  margin-bottom: 10px;
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

/* 主内容区域布局 */
.main-content {
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow: visible; /* 允许内容超出，由body控制滚动 */
}

/* 左侧区域 - 图像和地图 */
.left-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: visible;
}

/* 右侧区域 - 信息和工具 */
.right-section {
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: visible;
}

/* 图像区域 */
.image-section {
  background-color: #fff; /* 改为白色背景，与其他框保持一致 */
  border-radius: 4px;
  border: 1px solid #ebeef5;
  padding: 8px; /* 减小内边距，缩小白色框 */
  overflow: visible;
  max-height: 400px; /* 设置白色框的最大高度 */
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px; /* 减小标题下边距 */
}

/* 注释画布容器 */
.annotation-canvas {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: none; /* 取消最大高度限制，让图像正常显示 */
  overflow: visible;
  border: 1px solid #dcdfe6;
  background-color: #fff;
  box-sizing: border-box;
}

/* 确保图像不会超出容器 */
.annotation-canvas canvas,
.annotation-canvas img {
  max-width: 100%;
  max-height: 350px; /* 只限制图像最大高度，确保在白色框内显示 */
  display: block;
  margin: 0 auto;
  box-sizing: border-box;
}

/* 地图区域样式 */
.map-section {
  background-color: white;
  padding: 16px;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  height: 760px;
  display: flex;
  flex-direction: column;
}

.map-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #303133;
}

.map-container {
  flex: 1;
  width: 100%;
  height: 100%; /* 使用100%高度，让flex布局自动处理剩余空间 */
  min-height: 600px; /* 添加最小高度确保地图有足够空间显示 */
  border: 1px solid #ebeef5;
  border-radius: 4px;
  position: relative; /* 添加相对定位确保地图控件正常显示 */
}

/* 移除旧的地图布局样式 */
.map-info-section {
  display: none;
}

.go-back-button {
  margin-top: 20px;
}
</style>
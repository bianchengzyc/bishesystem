<template>
  <div class="image-list-container">
    <div class="header">
      <h2>单株枯死云杉高精度检测数据系统图像数据管理</h2>
      <div class="header-actions">
        <span class="user-info">
          当前用户: {{ authStore.user?.username }} ({{ authStore.userRole === 'admin' ? '管理员' : '普通用户' }})
        </span>
        <el-button type="primary" icon="Plus" @click="showUploadDialog">上传图像</el-button>
        <el-button v-if="authStore.userRole === 'admin'" type="success" icon="User" @click="goToRegister">添加用户</el-button>
        <el-button type="danger" icon="SwitchButton" @click="handleLogout">安全退出</el-button>
      </div>
    </div>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="上传图像"
      width="600px"
    >
      <el-form ref="uploadFormRef" :model="uploadForm" label-width="120px">
        <el-form-item label="选择图像" required>
          <el-upload
            class="image-uploader"
            :file-list="fileList"
            :auto-upload="false"
            :on-change="handleFileChange"
            accept=".jpg,.jpeg,.png,.tif,.tiff"
            :limit="1"
          >
            <el-button type="primary">点击选择图像</el-button>
            <template #tip>
              <div class="el-upload__tip">
                支持格式：JPG/JPEG/PNG/TIF/TIFF，且不超过200MB
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item label="拍摄日期" prop="capture_date" required>
          <el-date-picker
            v-model="uploadForm.capture_date"
            type="datetime"
            placeholder="选择拍摄日期时间"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="区域" prop="region" required>
          <el-input
            v-model="uploadForm.region"
            placeholder="请输入图像区域"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="分辨率" prop="resolution" required>
          <el-input-number
            v-model="uploadForm.resolution"
            :min="0.1"
            :max="100"
            :step="0.1"
            placeholder="请输入图像分辨率"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="坐标参考系统" prop="crs">
          <el-input
            v-model="uploadForm.crs"
            placeholder="请输入坐标参考系统（如EPSG:32632）"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="uploadDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleUpload">确定上传</el-button>
        </div>
      </template>
    </el-dialog>

    <div class="filter-section">
      <el-input
        v-model="searchQuery"
        placeholder="搜索图像名称"
        clearable
        class="search-input"
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-select
        v-model="filterStatus"
        placeholder="筛选状态"
        class="filter-select"
        @change="handleFilter"
      >
        <el-option label="全部" value="" />
        <el-option label="已标注" value="annotated" />
        <el-option label="未标注" value="unannotated" />
      </el-select>
    </div>

    <el-table
      v-loading="loading"
      :data="filteredImages"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column prop="image_id" label="ID" width="80" />
      <el-table-column prop="file_name" label="图像名称" min-width="200" />
      <el-table-column label="缩略图" width="120">
        <template #default="scope">
          <div v-if="scope.row.file_path?.toLowerCase().endsWith('.tif') || scope.row.file_path?.toLowerCase().endsWith('.tiff')">
            <!-- TIFF图像缩略图（使用Canvas渲染） -->
            <canvas 
              :ref="el => setCanvasRef(el, scope.row.image_id)"
              width="80" 
              height="60"
              style="width: 80px; height: 60px; cursor: pointer; object-fit: cover;"
              @click="viewAnnotations(scope.row)"
            />
          </div>
          <el-image
            v-else
            :src="getImageUrl(scope.row.file_path)"
            fit="cover"
            :preview-src-list="[getImageUrl(scope.row.file_path)]"
            style="width: 80px; height: 60px; cursor: pointer"
          />
        </template>
      </el-table-column>
      <el-table-column prop="upload_time" label="上传时间" width="180" />
      <el-table-column prop="image_width" label="宽度" width="80" />
      <el-table-column prop="image_height" label="高度" width="80" />
      <el-table-column prop="annotation_count" label="标注数量" width="100" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="scope">
          <el-button
            type="primary"
            size="small"
            @click="viewAnnotations(scope.row)"
          >
            查看标注
          </el-button>
          <el-button
            type="warning"
            size="small"
            @click="deleteImage(scope.row.image_id)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <div class="export-section">
      <el-button
        type="success"
        :disabled="selectedImages.length === 0"
        @click="exportSelected"
      >
        导出选中图像数据
      </el-button>
      <el-button type="success" @click="exportAll">导出全部数据</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import axios from 'axios'
import { fromUrl } from 'geotiff'

const router = useRouter()
const authStore = useAuthStore()
const token = computed(() => authStore.token)

const loading = ref(false)
const images = ref([])
const fileList = ref([])
const searchQuery = ref('')
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const selectedImages = ref([])
const canvasRefs = ref({})

// 设置Canvas引用
const setCanvasRef = (el, imageId) => {
  if (el) {
    canvasRefs.value[imageId] = el
  }
}

// 加载TIFF图像缩略图
const loadTiffThumbnail = async (image) => {
  try {
    const canvas = canvasRefs.value[image.image_id]
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    
    // 获取图像URL
    const imageUrl = getImageUrl(image.file_path)
    
    // 使用geotiff库加载TIFF图像
    const tiff = await fromUrl(imageUrl)
    
    // 获取第一个图像（包含所有波段）
    const firstImage = await tiff.getImage(0)
    
    // 获取图像尺寸
    const width = firstImage.getWidth()
    const height = firstImage.getHeight()
    
    // 读取所有波段数据
    const rasterData = await firstImage.readRasters()
    
    // 获取波段数量
    const numBands = firstImage.getSamplesPerPixel()
    
    // 创建缩放后的ImageData（缩略图尺寸）
    const thumbnailWidth = 80
    const thumbnailHeight = 60
    const thumbnailData = ctx.createImageData(thumbnailWidth, thumbnailHeight)
    
    // 计算缩放比例
    const scaleX = width / thumbnailWidth
    const scaleY = height / thumbnailHeight
    
    // 根据波段数量选择合适的组合
    if (numBands >= 3) {
      // 使用前三个波段作为RGB
      const rBand = 0
      const gBand = 1
      const bBand = 2
      
      const rData = rasterData[rBand]
      const gData = rasterData[gBand]
      const bData = rasterData[bBand]
      
      // 计算每个波段的最小值和最大值用于归一化
      const rMin = Math.min(...rData)
      const rMax = Math.max(...rData)
      const gMin = Math.min(...gData)
      const gMax = Math.max(...gData)
      const bMin = Math.min(...bData)
      const bMax = Math.max(...bData)
      
      // 生成缩略图数据
      for (let y = 0; y < thumbnailHeight; y++) {
        for (let x = 0; x < thumbnailWidth; x++) {
          // 计算原始图像坐标（最近邻采样）
          const origX = Math.floor(x * scaleX)
          const origY = Math.floor(y * scaleY)
          const index = origY * width + origX
          
          // 获取缩略图像素索引
          const thumbIndex = (y * thumbnailWidth + x) * 4
          
          // 归一化并设置像素值
          thumbnailData.data[thumbIndex] = Math.round(((rData[index] - rMin) / (rMax - rMin)) * 255)
          thumbnailData.data[thumbIndex + 1] = Math.round(((gData[index] - gMin) / (gMax - gMin)) * 255)
          thumbnailData.data[thumbIndex + 2] = Math.round(((bData[index] - bMin) / (bMax - bMin)) * 255)
          thumbnailData.data[thumbIndex + 3] = 255
        }
      }
    } else if (numBands === 1) {
      // 单波段图像 - 转换为灰度
      const bandData = rasterData[0]
      const min = Math.min(...bandData)
      const max = Math.max(...bandData)
      
      for (let y = 0; y < thumbnailHeight; y++) {
        for (let x = 0; x < thumbnailWidth; x++) {
          const origX = Math.floor(x * scaleX)
          const origY = Math.floor(y * scaleY)
          const index = origY * width + origX
          const thumbIndex = (y * thumbnailWidth + x) * 4
          
          const value = Math.round(((bandData[index] - min) / (max - min)) * 255)
          thumbnailData.data[thumbIndex] = value
          thumbnailData.data[thumbIndex + 1] = value
          thumbnailData.data[thumbIndex + 2] = value
          thumbnailData.data[thumbIndex + 3] = 255
        }
      }
    }
    
    // 绘制到Canvas
    ctx.putImageData(thumbnailData, 0, 0)
    
  } catch (error) {
    console.error('加载TIFF缩略图失败:', error)
    // 绘制错误提示
    const canvas = canvasRefs.value[image.image_id]
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#999'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('FAILED', canvas.width / 2, canvas.height / 2)
    }
  }
}

// 更新所有TIFF缩略图
const updateTiffThumbnails = () => {
  images.value.forEach(image => {
    if (image.file_path?.toLowerCase().endsWith('.tif') || image.file_path?.toLowerCase().endsWith('.tiff')) {
      loadTiffThumbnail(image)
    }
  })
}

// 上传对话框相关
const uploadDialogVisible = ref(false)
const uploadFormRef = ref()
const uploadForm = ref({
  capture_date: new Date(),
  region: '',
  resolution: 1,
  crs: 'EPSG:32632'
})
const selectedFile = ref(null)

const filteredImages = computed(() => {
  let result = [...images.value]
  
  // 搜索过滤
  if (searchQuery.value) {
    result = result.filter(image => 
      image.file_name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  
  // 状态过滤
  if (filterStatus.value === 'annotated') {
    result = result.filter(image => image.annotation_count > 0)
  } else if (filterStatus.value === 'unannotated') {
    result = result.filter(image => image.annotation_count === 0)
  }
  
  return result
})

const getImages = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/images', {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      images.value = data.images
      total.value = data.total
      
      // 延迟调用更新缩略图函数，确保DOM已经渲染完成
      setTimeout(() => {
        updateTiffThumbnails()
      }, 100)
    } else {
      throw new Error('获取图像列表失败')
    }
  } catch (error) {
    console.error('Error fetching images:', error)
    ElMessage.error('获取图像列表失败')
  } finally {
    loading.value = false
  }
}

// 上传对话框方法
const showUploadDialog = () => {
  // 重置表单
  uploadForm.value = {
    capture_date: new Date(),
    region: '',
    resolution: 1,
    crs: 'EPSG:32632'
  }
  fileList.value = []
  selectedFile.value = null
  uploadDialogVisible.value = true
}

const handleFileChange = (file, fileList) => {
  // 检查文件类型 - 支持所有图像格式
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/tiff', 
    'image/tif'
  ]
  
  if (!allowedTypes.includes(file.raw.type)) {
    ElMessage.error('仅支持JPG/JPEG/PNG/TIF/TIFF格式的图像文件')
    return false
  }
  
  // 检查文件大小
  if (file.raw.size / 1024 / 1024 >= 200) {
    ElMessage.error('上传图片大小不能超过200MB')
    return false
  }
  
  selectedFile.value = file.raw
}

const handleUpload = async () => {
  if (!selectedFile.value) {
    ElMessage.error('请先选择要上传的图像')
    return
  }
  
  // 创建FormData对象
  const formData = new FormData()
  formData.append('image', selectedFile.value)
  formData.append('capture_date', uploadForm.value.capture_date)
  formData.append('region', uploadForm.value.region)
  formData.append('resolution', uploadForm.value.resolution)
  formData.append('crs', uploadForm.value.crs)
  
  try {
    const response = await fetch('/api/images/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`
      },
      body: formData
    })
    
    const data = await response.json()
    
    if (response.ok && data.success) {
      ElMessage.success('上传成功')
      uploadDialogVisible.value = false
      getImages() // 重新获取图像列表
    } else {
      ElMessage.error(data.message || '上传失败')
    }
  } catch (error) {
    console.error('Error uploading image:', error)
    ElMessage.error('上传失败，请重试')
  }
}

const handleSearch = () => {
  currentPage.value = 1
}

const handleFilter = () => {
  currentPage.value = 1
}

const viewAnnotations = (image) => {
  router.push({ path: `/annotations/${image.image_id}`, query: { image: JSON.stringify(image) } })
}

const goToRegister = () => {
  router.push('/register')
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'info'
  }).then(() => {
    // 清除认证信息
    authStore.logout()
    
    // 显示成功消息
    ElMessage.success('已成功退出登录')
    
    // 跳转到登录页面
    router.push('/login')
  }).catch(() => {
    // 用户取消退出，不执行任何操作
  })
}

const deleteImage = async (imageId) => {
  try {
    await ElMessageBox.confirm('确定要删除这张图像吗？此操作不可恢复。', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await fetch(`/api/images/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })
    
    if (response.ok) {
      ElMessage.success('删除成功')
      getImages()
    } else {
      throw new Error('删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Error deleting image:', error)
      ElMessage.error('删除失败')
    }
  }
}

const handleSelectionChange = (selection) => {
  selectedImages.value = selection
}

const exportSelected = async () => {
  if (selectedImages.value.length === 0) {
    ElMessage.warning('请选择要导出的图像')
    return
  }
  
  const imageIds = selectedImages.value.map(img => img.image_id).join(',')
  
  try {
    console.log('开始导出选中图像，image_ids:', imageIds)
    console.log('token:', token.value)
    
    const response = await axios.get('/api/export/yolo', {
      params: { image_ids: imageIds },
      headers: {
        'Authorization': `Bearer ${token.value}`
      },
      responseType: 'blob'
    })
    
    console.log('导出请求成功，响应状态:', response.status)
    console.log('响应类型:', response.headers['content-type'])
    
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `yolo-export-${Date.now()}.zip`)
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    if (error.response) {
      console.error('错误响应状态:', error.response.status)
      console.error('错误响应数据:', error.response.data)
      console.error('错误响应头:', error.response.headers)
    } else if (error.request) {
      console.error('没有收到响应:', error.request)
    } else {
      console.error('请求配置错误:', error.message)
    }
    ElMessage.error('导出失败，请重试')
  }
}

const exportAll = async () => {
  try {
    console.log('开始导出全部图像')
    console.log('token:', token.value)
    
    const response = await axios.get('/api/export/yolo', {
      headers: {
        'Authorization': `Bearer ${token.value}`
      },
      responseType: 'blob'
    })
    
    console.log('导出请求成功，响应状态:', response.status)
    console.log('响应类型:', response.headers['content-type'])
    
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `yolo-export-${Date.now()}.zip`)
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    if (error.response) {
      console.error('错误响应状态:', error.response.status)
      console.error('错误响应数据:', error.response.data)
      console.error('错误响应头:', error.response.headers)
    } else if (error.request) {
      console.error('没有收到响应:', error.request)
    } else {
      console.error('请求配置错误:', error.message)
    }
    ElMessage.error('导出失败，请重试')
  }
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

const handleCurrentChange = (page) => {
  currentPage.value = page
}

const getImageUrl = (filePath) => {
  // 从完整路径中提取文件名
  if (!filePath) return ''
  
  // 处理Windows路径分隔符和Unix路径分隔符
  const normalizedPath = filePath.replace(/\\/g, '/')
  const filename = normalizedPath.split('/').pop()
  
  // 使用静态文件服务直接访问图片
  return `/uploads/images/${filename}`
}

onMounted(() => {
  if (!token.value) {
    router.push('/login')
    return
  }
  getImages()
})
</script>

<style scoped>
.image-list-container {
  padding: 20px;
  max-width: 1400px;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info {
  color: #666;
  font-size: 14px;
  margin-right: 10px;
  padding: 5px 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}

.filter-section {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-input {
  width: 300px;
}

.filter-select {
  width: 150px;
}

.upload-button {
  margin-left: auto;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.export-section {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>
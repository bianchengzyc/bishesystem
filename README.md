# 单株枯死云杉高精度检测数据系统

这是一个用于管理和标注枯死云杉图像数据的Web应用系统，支持YOLO格式数据导出功能。
用于作者的毕设信息系统，<1103715359@qq.com>

- SQLite (数据库)
- JWT (认证)

## 项目结构

- client/          # Vue.js前端项目
- server/          # Node.js/Express后端API
- database.sqlite  # SQLite数据库

## 技术栈

- **前端**: Vue 3, Element Plus, Axios, Pinia
- **后端**: Node.js, Express, Sequelize, SQLite
- **数据格式**: YOLO v5/v8 (用于目标检测标注)

## 前提条件

- Node.js 16+ 和 npm
- 现代浏览器 (Chrome, Firefox, Edge)
└── README.md        # 项目说明文档

```

### 1. 安装依赖

### 安装后端依赖
# 安装后端依赖
```bash
cd server
npm install

# 安装前端依赖
```bash
cd client
npm install

### 2. 启动服务器

###  启动后端服务器
# 启动后端服务器 (默认端口 3000)
``bash
cd server
node app.js    # 或者使用 npm start 启动
（如果系统没有管理员账号无法登录，请先使用npm run create-admin创建有个管理员账号）

###  启动前端开发服务器
# 启动前端开发服务器 (默认端口 5173)
```bash
cd client
npm run dev
### 3. 访问应用

打开浏览器访问: `http://localhost:5173`
打开浏览器访问：<http://localhost:5173>

1. **图像上传**: 支持上传JPG、PNG、TIF格式的图像
2. **图像标注**: 对图像中的枯死云杉进行矩形框标注
3. **数据管理**: 查看、搜索、筛选图像列表
4. **数据导出**: 支持将标注数据导出为YOLO格式

## 导出功能

- 导出选中图像数据: 选择一个或多个图像进行导出
- 导出全部数据: 导出所有带标注的图像数据
- 导出格式: YOLO v5/v8 (包含images和labels目录的ZIP文件)

## 数据库

系统使用SQLite数据库，数据库文件为: `database.sqlite`

1. 首次启动时，系统会自动创建数据库表结构
2. 上传的图像会保存在 `server/uploads/images/` 目录
3. 导出的ZIP文件会临时保存在 `server/exports/` 目录，下载完成后自动删除

## 常见问题

### 1. 无法访问应用
- 确保后端服务器正在运行 (端口 3000)
- 确保前端开发服务器正在运行 (端口 5173)
- 检查浏览器网络连接

### 2. 上传图像失败
- 确保图像格式正确 (JPG/PNG/TIF)
- 确保图像大小不超过200MB

### 3. 导出失败
- 确保选中的图像包含标注数据
- 检查浏览器控制台和服务器日志获取详细错误信息

## 注意事项

- 首次启动时会自动创建数据库文件
- 图像文件会保存在服务器的指定目录
- 导出的YOLO数据包含图像文件和标注文件

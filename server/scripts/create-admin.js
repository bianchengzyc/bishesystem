const bcrypt = require('bcrypt');
const User = require('../models/User');
const sequelize = require('../config/db');

async function createAdmin() {
  try {
    console.log('=== 创建管理员账户脚本 ===');
    
    // 连接数据库
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 检查是否已经存在管理员
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    if (existingAdmin) {
      console.log(`✅ 管理员账户已存在: ${existingAdmin.username}`);
      return;
    }
    
    // 创建默认管理员账户
    const username = 'admin';
    const password = 'admin123'; // 建议用户登录后立即修改
    const role = 'admin';
    
    // 密码加密
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // 创建管理员
    const admin = await User.create({
      username,
      password: hashedPassword,
      role
    });
    
    console.log('✅ 管理员账户创建成功!');
    console.log(`📝 管理员信息:`);
    console.log(`   用户名: ${admin.username}`);
    console.log(`   密码: ${password}`);
    console.log(`   角色: ${admin.role}`);
    console.log(`   创建时间: ${admin.created_at}`);
    console.log('');
    console.log('⚠️  安全提醒:');
    console.log('   1. 请登录后立即修改默认密码');
    console.log('   2. 使用强密码，包含字母、数字和特殊字符');
    console.log('   3. 定期更新密码');
    console.log('');
    console.log('🚀 现在您可以使用 admin/admin123 登录系统了！');
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ 创建管理员账户失败:', error.message);
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.log('💡 提示: 管理员账户可能已经存在，请检查数据库');
    }
    process.exit(1);
  }
}

// 运行脚本
createAdmin();
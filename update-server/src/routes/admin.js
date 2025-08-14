const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');
const versionService = require('../services/versionService');

// 简单的API密钥认证中间件
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validApiKey = process.env.ADMIN_API_KEY;
  
  if (!validApiKey) {
    return res.status(500).json({ error: 'Server configuration error: No API key configured' });
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  
  next();
};

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../releases');
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // 保持原始文件名
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB 限制
  },
  fileFilter: (req, file, cb) => {
    // 允许的文件扩展名
    const allowedExts = ['.exe', '.dmg', '.deb', '.rpm', '.AppImage', '.zip', '.tar.gz'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedExts.join(', ')}`));
    }
  }
});

// 创建新版本
router.post('/version', authenticate, async (req, res) => {
  try {
    const { version, changelog, required, minVersion } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: 'Version is required' });
    }

    const versionInfo = {
      version,
      changelog: changelog || '',
      required: required || false,
      minVersion: minVersion || null,
      files: []
    };

    const newVersion = await versionService.addVersion(versionInfo);
    
    logger.info(`Admin created version ${version}`);
    res.status(201).json(newVersion);
    
  } catch (error) {
    logger.error('Error creating version:', error);
    if (error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// 上传文件到指定版本
router.post('/version/:version/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { version } = req.params;
    const { platform, arch } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      name: req.file.filename,
      platform: platform || null,
      arch: arch || null
    };

    const file = await versionService.addFileToVersion(version, fileInfo, req.file.path);
    
    logger.info(`Admin uploaded file ${req.file.filename} to version ${version}`);
    res.status(201).json(file);
    
  } catch (error) {
    logger.error('Error uploading file:', error);
    
    // 如果出错，删除已上传的文件
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (deleteError) {
        logger.error('Error deleting uploaded file after error:', deleteError);
      }
    }
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// 更新版本信息
router.put('/version/:version', authenticate, async (req, res) => {
  try {
    const { version } = req.params;
    const updates = req.body;
    
    // 不允许更新版本号本身
    delete updates.version;
    
    const updatedVersion = await versionService.updateVersion(version, updates);
    
    logger.info(`Admin updated version ${version}`);
    res.json(updatedVersion);
    
  } catch (error) {
    logger.error('Error updating version:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// 删除版本
router.delete('/version/:version', authenticate, async (req, res) => {
  try {
    const { version } = req.params;
    
    await versionService.deleteVersion(version);
    
    logger.info(`Admin deleted version ${version}`);
    res.json({ message: 'Version deleted successfully' });
    
  } catch (error) {
    logger.error('Error deleting version:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// 获取服务器状态
router.get('/status', authenticate, async (req, res) => {
  try {
    const versions = await versionService.getAllVersions();
    const latest = await versionService.getLatestVersion();
    
    // 计算存储使用情况
    const releasesPath = path.join(__dirname, '../../releases');
    let totalSize = 0;
    let fileCount = 0;
    
    if (await fs.pathExists(releasesPath)) {
      const files = await fs.readdir(releasesPath);
      for (const file of files) {
        const filePath = path.join(releasesPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          fileCount++;
        }
      }
    }
    
    const status = {
      totalVersions: versions.length,
      latestVersion: latest ? latest.version : null,
      storage: {
        totalFiles: fileCount,
        totalSize: totalSize,
        totalSizeFormatted: formatBytes(totalSize)
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
    
  } catch (error) {
    logger.error('Error getting server status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 批量上传文件
router.post('/version/:version/upload-batch', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    const { version } = req.params;
    const { platforms, archs } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const platformArray = Array.isArray(platforms) ? platforms : [platforms];
    const archArray = Array.isArray(archs) ? archs : [archs];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileInfo = {
        name: file.filename,
        platform: platformArray[i] || null,
        arch: archArray[i] || null
      };
      
      try {
        const uploadedFile = await versionService.addFileToVersion(version, fileInfo, file.path);
        results.push({ success: true, file: uploadedFile });
      } catch (error) {
        logger.error(`Error uploading file ${file.filename}:`, error);
        results.push({ success: false, filename: file.filename, error: error.message });
        
        // 删除失败的文件
        try {
          await fs.remove(file.path);
        } catch (deleteError) {
          logger.error('Error deleting failed upload:', deleteError);
        }
      }
    }
    
    logger.info(`Admin batch uploaded ${results.filter(r => r.success).length}/${req.files.length} files to version ${version}`);
    res.status(201).json({ results });
    
  } catch (error) {
    logger.error('Error in batch upload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 工具函数：格式化字节数
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;
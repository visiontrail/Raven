const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');
const versionService = require('../services/versionService');

// 下载特定版本的文件
router.get('/:version/:filename', async (req, res) => {
  try {
    const { version, filename } = req.params;
    
    // 验证版本是否存在
    const versionInfo = await versionService.getVersion(version);
    if (!versionInfo) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // 验证文件是否属于该版本
    const file = versionInfo.files.find(f => f.name === filename);
    if (!file) {
      return res.status(404).json({ error: 'File not found in this version' });
    }

    const filePath = path.join(__dirname, '../../releases', filename);
    
    // 检查文件是否存在
    if (!await fs.pathExists(filePath)) {
      logger.error(`File not found on disk: ${filePath}`);
      return res.status(404).json({ error: 'File not found on server' });
    }

    // 获取文件信息
    const stats = await fs.stat(filePath);
    
    // 设置响应头
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=31536000', // 缓存1年
      'ETag': file.hash
    });

    // 支持断点续传
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize
      });
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // 普通下载
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }

    // 记录下载日志
    logger.info(`File downloaded: ${filename} (version: ${version}) by ${req.ip}`);
    
  } catch (error) {
    logger.error('Error downloading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取文件信息（不下载）
router.head('/:version/:filename', async (req, res) => {
  try {
    const { version, filename } = req.params;
    
    const versionInfo = await versionService.getVersion(version);
    if (!versionInfo) {
      return res.status(404).end();
    }

    const file = versionInfo.files.find(f => f.name === filename);
    if (!file) {
      return res.status(404).end();
    }

    const filePath = path.join(__dirname, '../../releases', filename);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).end();
    }

    const stats = await fs.stat(filePath);
    
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=31536000',
      'ETag': file.hash,
      'Accept-Ranges': 'bytes'
    });

    res.status(200).end();
    
  } catch (error) {
    logger.error('Error getting file info:', error);
    res.status(500).end();
  }
});

// 获取下载统计
router.get('/stats/:version', async (req, res) => {
  try {
    const { version } = req.params;
    
    const versionInfo = await versionService.getVersion(version);
    if (!versionInfo) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // 这里可以实现下载统计功能
    // 目前返回基本信息
    const stats = {
      version: version,
      files: versionInfo.files.map(file => ({
        name: file.name,
        size: file.size,
        platform: file.platform,
        arch: file.arch,
        downloadCount: 0 // 可以从数据库或日志中获取实际下载次数
      }))
    };

    res.json(stats);
    
  } catch (error) {
    logger.error('Error getting download stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
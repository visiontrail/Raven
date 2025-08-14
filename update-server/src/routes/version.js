const express = require('express');
const router = express.Router();
const versionService = require('../services/versionService');
const logger = require('../utils/logger');

// 获取最新版本信息
router.get('/latest', async (req, res) => {
  try {
    const latest = await versionService.getLatestVersion();
    
    if (!latest) {
      return res.status(404).json({ error: 'No versions available' });
    }

    res.json({
      version: latest.version,
      publishedAt: latest.publishedAt,
      changelog: latest.changelog,
      files: latest.files,
      required: latest.required || false
    });
  } catch (error) {
    logger.error('Error getting latest version:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 检查更新
router.get('/check', async (req, res) => {
  try {
    const { current, platform, arch } = req.query;
    
    if (!current) {
      return res.status(400).json({ error: 'Current version is required' });
    }

    const updateInfo = await versionService.checkForUpdates(current, platform, arch);
    
    res.json(updateInfo);
  } catch (error) {
    logger.error('Error checking for updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取所有版本列表
router.get('/list', async (req, res) => {
  try {
    const versions = await versionService.getAllVersions();
    res.json({ versions });
  } catch (error) {
    logger.error('Error getting version list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取特定版本信息
router.get('/:version', async (req, res) => {
  try {
    const { version } = req.params;
    const versionInfo = await versionService.getVersion(version);
    
    if (!versionInfo) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(versionInfo);
  } catch (error) {
    logger.error('Error getting version info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// electron-updater 兼容性端点
// 这个端点模拟 GitHub releases API 的响应格式
router.get('/github-compatible/latest', async (req, res) => {
  try {
    const latest = await versionService.getLatestVersion();
    
    if (!latest) {
      return res.status(404).json({ error: 'No versions available' });
    }

    // 转换为 GitHub releases API 格式
    const githubFormat = {
      tag_name: latest.version,
      name: `Release ${latest.version}`,
      published_at: latest.publishedAt,
      body: latest.changelog,
      assets: latest.files.map(file => ({
        name: file.name,
        browser_download_url: file.url,
        size: file.size,
        content_type: 'application/octet-stream'
      }))
    };

    res.json(githubFormat);
  } catch (error) {
    logger.error('Error getting GitHub compatible format:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// electron-updater yml 格式端点
router.get('/yml/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const latest = await versionService.getLatestVersion();
    
    if (!latest) {
      return res.status(404).text('No versions available');
    }

    // 查找适合平台的文件
    const platformFiles = latest.files.filter(file => 
      !file.platform || file.platform === platform
    );

    if (platformFiles.length === 0) {
      return res.status(404).text('No files for this platform');
    }

    // 生成 yml 格式响应
    const file = platformFiles[0]; // 取第一个匹配的文件
    const yml = `version: ${latest.version}
files:
  - url: ${file.name}
    sha512: ${file.hash}
    size: ${file.size}
path: ${file.name}
sha512: ${file.hash}
releaseDate: '${latest.publishedAt}'`;

    res.set('Content-Type', 'text/yaml');
    res.send(yml);
  } catch (error) {
    logger.error('Error generating yml format:', error);
    res.status(500).text('Internal server error');
  }
});

module.exports = router;
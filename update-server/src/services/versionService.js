const fs = require('fs-extra');
const path = require('path');
const semver = require('semver');
const crypto = require('crypto');
const logger = require('../utils/logger');

class VersionService {
  constructor() {
    this.dataPath = path.join(__dirname, '../../data/versions.json');
    this.releasesPath = path.join(__dirname, '../../releases');
    this.initializeData();
  }

  async initializeData() {
    try {
      await fs.ensureDir(path.dirname(this.dataPath));
      await fs.ensureDir(this.releasesPath);
      
      if (!await fs.pathExists(this.dataPath)) {
        const initialData = {
          latestVersion: null,
          versions: {},
          lastUpdated: new Date().toISOString()
        };
        await fs.writeJson(this.dataPath, initialData, { spaces: 2 });
        logger.info('Initialized versions.json');
      }
    } catch (error) {
      logger.error('Failed to initialize version data:', error);
      throw error;
    }
  }

  async loadVersions() {
    try {
      return await fs.readJson(this.dataPath);
    } catch (error) {
      logger.error('Failed to load versions:', error);
      throw error;
    }
  }

  async saveVersions(data) {
    try {
      data.lastUpdated = new Date().toISOString();
      await fs.writeJson(this.dataPath, data, { spaces: 2 });
      logger.info('Versions data saved successfully');
    } catch (error) {
      logger.error('Failed to save versions:', error);
      throw error;
    }
  }

  async getLatestVersion() {
    const data = await this.loadVersions();
    if (!data.latestVersion) {
      return null;
    }
    return data.versions[data.latestVersion];
  }

  async getAllVersions() {
    const data = await this.loadVersions();
    return Object.values(data.versions).sort((a, b) => semver.rcompare(a.version, b.version));
  }

  async getVersion(version) {
    const data = await this.loadVersions();
    return data.versions[version] || null;
  }

  async checkForUpdates(currentVersion, platform, arch) {
    try {
      const latest = await this.getLatestVersion();
      if (!latest) {
        return { hasUpdate: false, message: 'No versions available' };
      }

      if (!semver.valid(currentVersion)) {
        return { hasUpdate: false, message: 'Invalid current version format' };
      }

      const hasUpdate = semver.gt(latest.version, currentVersion);
      
      if (!hasUpdate) {
        return { hasUpdate: false, message: 'Already up to date' };
      }

      // 查找适合当前平台和架构的文件
      const compatibleFiles = latest.files.filter(file => {
        return (!file.platform || file.platform === platform) &&
               (!file.arch || file.arch === arch);
      });

      if (compatibleFiles.length === 0) {
        return { hasUpdate: false, message: 'No compatible files for your platform' };
      }

      return {
        hasUpdate: true,
        version: latest.version,
        publishedAt: latest.publishedAt,
        changelog: latest.changelog,
        files: compatibleFiles,
        required: latest.required || false,
        minVersion: latest.minVersion
      };
    } catch (error) {
      logger.error('Error checking for updates:', error);
      throw error;
    }
  }

  async addVersion(versionInfo) {
    try {
      const data = await this.loadVersions();
      
      if (!semver.valid(versionInfo.version)) {
        throw new Error('Invalid version format');
      }

      if (data.versions[versionInfo.version]) {
        throw new Error('Version already exists');
      }

      // 添加版本信息
      data.versions[versionInfo.version] = {
        version: versionInfo.version,
        publishedAt: versionInfo.publishedAt || new Date().toISOString(),
        changelog: versionInfo.changelog || '',
        files: versionInfo.files || [],
        required: versionInfo.required || false,
        minVersion: versionInfo.minVersion || null
      };

      // 更新最新版本
      if (!data.latestVersion || semver.gt(versionInfo.version, data.latestVersion)) {
        data.latestVersion = versionInfo.version;
      }

      await this.saveVersions(data);
      logger.info(`Added version ${versionInfo.version}`);
      
      return data.versions[versionInfo.version];
    } catch (error) {
      logger.error('Error adding version:', error);
      throw error;
    }
  }

  async updateVersion(version, updates) {
    try {
      const data = await this.loadVersions();
      
      if (!data.versions[version]) {
        throw new Error('Version not found');
      }

      data.versions[version] = { ...data.versions[version], ...updates };
      await this.saveVersions(data);
      
      logger.info(`Updated version ${version}`);
      return data.versions[version];
    } catch (error) {
      logger.error('Error updating version:', error);
      throw error;
    }
  }

  async deleteVersion(version) {
    try {
      const data = await this.loadVersions();
      
      if (!data.versions[version]) {
        throw new Error('Version not found');
      }

      // 删除版本文件
      const versionData = data.versions[version];
      for (const file of versionData.files) {
        const filePath = path.join(this.releasesPath, file.name);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          logger.info(`Deleted file: ${file.name}`);
        }
      }

      delete data.versions[version];

      // 如果删除的是最新版本，需要重新计算最新版本
      if (data.latestVersion === version) {
        const versions = Object.keys(data.versions);
        if (versions.length > 0) {
          data.latestVersion = versions.sort(semver.rcompare)[0];
        } else {
          data.latestVersion = null;
        }
      }

      await this.saveVersions(data);
      logger.info(`Deleted version ${version}`);
      
      return true;
    } catch (error) {
      logger.error('Error deleting version:', error);
      throw error;
    }
  }

  async calculateFileHash(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      logger.error('Error calculating file hash:', error);
      throw error;
    }
  }

  async addFileToVersion(version, fileInfo, filePath) {
    try {
      const data = await this.loadVersions();
      
      if (!data.versions[version]) {
        throw new Error('Version not found');
      }

      // 计算文件哈希
      const hash = await this.calculateFileHash(filePath);
      const stats = await fs.stat(filePath);

      const file = {
        name: fileInfo.name,
        url: `${process.env.BASE_URL || 'http://localhost:8082'}/releases/${fileInfo.name}`,
        size: stats.size,
        platform: fileInfo.platform || null,
        arch: fileInfo.arch || null,
        hash: hash,
        uploadedAt: new Date().toISOString()
      };

      data.versions[version].files.push(file);
      await this.saveVersions(data);
      
      logger.info(`Added file ${fileInfo.name} to version ${version}`);
      return file;
    } catch (error) {
      logger.error('Error adding file to version:', error);
      throw error;
    }
  }
}

module.exports = new VersionService();
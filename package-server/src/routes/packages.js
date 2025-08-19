const express = require('express');
const PackageService = require('../services/PackageService');
const router = express.Router();

// 获取所有包列表
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      type = '', 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    let packages = PackageService.getPackages();

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      packages = packages.filter(pkg => 
        pkg.name.toLowerCase().includes(searchLower) ||
        pkg.version.toLowerCase().includes(searchLower)
      );
    }

    // 类型过滤
    if (type) {
      packages = packages.filter(pkg => pkg.type === type);
    }

    // 排序
    packages.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'createdAt') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });

    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedPackages = packages.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        packages: paginatedPackages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(packages.length / limit),
          totalItems: packages.length,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({
      success: false,
      message: '获取包列表失败'
    });
  }
});

// 根据ID获取单个包信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const packageInfo = PackageService.getPackageById(id);
    
    if (!packageInfo) {
      return res.status(404).json({
        success: false,
        message: '包不存在'
      });
    }
    
    res.json({
      success: true,
      data: packageInfo
    });
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({
      success: false,
      message: '获取包信息失败'
    });
  }
});



// 删除包
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPackage = PackageService.deletePackage(id);
    
    res.json({
      success: true,
      message: '包删除成功',
      data: deletedPackage
    });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除包失败'
    });
  }
});

// 获取包统计信息
router.get('/stats/overview', async (req, res) => {
  try {
    const packages = PackageService.getPackages();
    
    const stats = {
      totalPackages: packages.length,
      totalSize: packages.reduce((sum, pkg) => sum + pkg.size, 0),
      packagesByType: {},
      recentPackages: packages
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    };
    
    // 按类型统计
    packages.forEach(pkg => {
      if (!stats.packagesByType[pkg.type]) {
        stats.packagesByType[pkg.type] = 0;
      }
      stats.packagesByType[pkg.type]++;
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败'
    });
  }
});

module.exports = router;
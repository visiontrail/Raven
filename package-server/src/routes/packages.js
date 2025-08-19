const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const moment = require('moment')
const PackageService = require('../services/PackageService')

const router = express.Router()
const packageService = new PackageService()

// Get all packages with optional filtering
router.get('/', async (req, res) => {
  try {
    const { search, type, version, dateFrom, dateTo, page = 1, limit = 20 } = req.query
    
    let packages = await packageService.getAllPackages()
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      packages = packages.filter(pkg => 
        pkg.name.toLowerCase().includes(searchLower) ||
        pkg.metadata.description.toLowerCase().includes(searchLower) ||
        pkg.metadata.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }
    
    if (type) {
      packages = packages.filter(pkg => pkg.packageType === type)
    }
    
    if (version) {
      packages = packages.filter(pkg => pkg.version.includes(version))
    }
    
    if (dateFrom) {
      const fromDate = moment(dateFrom)
      packages = packages.filter(pkg => moment(pkg.createdAt).isAfter(fromDate))
    }
    
    if (dateTo) {
      const toDate = moment(dateTo)
      packages = packages.filter(pkg => moment(pkg.createdAt).isBefore(toDate))
    }
    
    // Sort by creation date (newest first)
    packages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    
    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + parseInt(limit)
    const paginatedPackages = packages.slice(startIndex, endIndex)
    
    res.json({
      packages: paginatedPackages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(packages.length / limit),
        totalItems: packages.length,
        itemsPerPage: parseInt(limit)
      }
    })
  } catch (error) {
    console.error('Error fetching packages:', error)
    res.status(500).json({ error: 'Failed to fetch packages' })
  }
})

// Get package by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const package = await packageService.getPackageById(id)
    
    if (!package) {
      return res.status(404).json({ error: 'Package not found' })
    }
    
    res.json(package)
  } catch (error) {
    console.error('Error fetching package:', error)
    res.status(500).json({ error: 'Failed to fetch package' })
  }
})

// Update package metadata
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { metadata } = req.body
    
    if (!metadata) {
      return res.status(400).json({ error: 'Metadata is required' })
    }
    
    const success = await packageService.updatePackageMetadata(id, metadata)
    
    if (!success) {
      return res.status(404).json({ error: 'Package not found' })
    }
    
    res.json({ message: 'Package metadata updated successfully' })
  } catch (error) {
    console.error('Error updating package:', error)
    res.status(500).json({ error: 'Failed to update package' })
  }
})

// Delete package
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const success = await packageService.deletePackage(id)
    
    if (!success) {
      return res.status(404).json({ error: 'Package not found' })
    }
    
    res.json({ message: 'Package deleted successfully' })
  } catch (error) {
    console.error('Error deleting package:', error)
    res.status(500).json({ error: 'Failed to delete package' })
  }
})

// Get package statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const packages = await packageService.getAllPackages()
    
    const stats = {
      totalPackages: packages.length,
      totalSize: packages.reduce((sum, pkg) => sum + pkg.size, 0),
      packageTypes: {},
      recentUploads: packages
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          version: pkg.version,
          createdAt: pkg.createdAt,
          size: pkg.size
        }))
    }
    
    // Count packages by type
    packages.forEach(pkg => {
      stats.packageTypes[pkg.packageType] = (stats.packageTypes[pkg.packageType] || 0) + 1
    })
    
    res.json(stats)
  } catch (error) {
    console.error('Error fetching package statistics:', error)
    res.status(500).json({ error: 'Failed to fetch package statistics' })
  }
})

module.exports = router
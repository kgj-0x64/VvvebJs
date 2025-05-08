const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/**
 * Sanitizes a path to prevent security issues
 * Direct port of the PHP sanitizePath function
 */
function sanitizePath(path) {
  if (!path) return '';
  
  // Sanitize: normalize slashes, remove GET parameters, double dots, and invalid characters
  // This matches the exact regex patterns from the PHP version
  return path
    .replace(/\/+/g, path.sep)          // Normalize slashes to match DIRECTORY_SEPARATOR
    .replace(/\?.*$/, '')               // Remove GET parameters
    .replace(/\.{2,}/g, '')             // Remove double dots
    .replace(/[^\/\\a-zA-Z0-9\-\._]/g, ''); // Remove invalid chars
}

/**
 * Recursive function to scan directory and build file/folder structure
 */
function scanDirectory(dir, baseDir) {
  const files = [];

  // Check if directory exists
  if (fs.existsSync(dir)) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      // Skip hidden files (starting with .)
      if (!item || item[0] === '.') {
        continue;
      }

      const fullPath = path.join(dir, item);
      const relativePath = path.join(dir.replace(baseDir, ''), item).replace(/\\/g, '/');
      // Always use forward slashes for web paths (normalize for JSON response)
      const normalizedPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      
      if (fs.statSync(fullPath).isDirectory()) {
        // It's a directory/folder
        files.push({
          name: item,
          type: 'folder',
          path: normalizedPath,
          items: scanDirectory(fullPath, baseDir) // Recursively scan subdirectories
        });
      } else {
        // It's a file
        files.push({
          name: item,
          type: 'file',
          path: normalizedPath,
          size: fs.statSync(fullPath).size // Get file size
        });
      }
    }
  }

  return files;
}

// Route handler for scanning media directory
router.post('/scan', (req, res) => {
  try {
    // Determine the upload path (equivalent to PHP's UPLOAD_PATH)
    let uploadPath = 'media'; // Default path
    
    if (req.body.mediaPath) {
      const sanitized = sanitizePath(req.body.mediaPath.substring(0, 256));
      if (sanitized) {
        uploadPath = sanitized;
      }
    }

    // Full directory path to scan
    const scandir = path.join(__dirname, uploadPath);
    
    // Scan the directory recursively
    const response = scanDirectory(scandir, scandir);
    
    // Return the same JSON structure as the PHP version
    res.json({
      name: '',
      type: 'folder',
      path: '',
      items: response
    });
    
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
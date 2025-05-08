const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// File extension configurations - matching the PHP configuration
const uploadDenyExtensions = ['php'];
const uploadAllowExtensions = ['ico', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

/**
 * Error response helper function (equivalent to PHP's showError)
 */
function showError(res, error) {
  return res.status(500).send(error);
}

/**
 * Sanitizes a filename to prevent security issues
 * Direct port of the PHP sanitizeFileName function
 */
function sanitizeFileName(file) {
  if (!file) return '';
  
  const disallow = ['.htaccess', 'passwd'];
  let sanitized = file;
  
  // Remove disallowed terms
  disallow.forEach(term => {
    sanitized = sanitized.replace(term, '');
  });
  
  // Sanitize: remove double dots, GET parameters, and invalid characters
  // This matches the exact regex patterns from the PHP version
  sanitized = sanitized
    .replace(/\?.*$/, '')                // Remove GET parameters
    .replace(/\.{2,}/g, '')             // Remove double dots
    .replace(/[^\/\\a-zA-Z0-9\-\._]/g, ''); // Remove invalid chars
  
  return sanitized;
}

/**
 * Validates if a file extension is allowed
 * Directly implements the PHP validation logic
 */
function validateExtension(extension) {
  extension = extension.toLowerCase();
  
  // Check if extension is on deny list (matching PHP logic)
  if (uploadDenyExtensions.includes(extension)) {
    throw new Error(`File type ${extension} not allowed!`);
  }
  
  // Check if extension is on allow list (matching PHP logic)
  if (!uploadAllowExtensions.includes(extension)) {
    throw new Error(`File type ${extension} not allowed!`);
  }
  
  return true;
}

// Set up multer middleware with fileFilter for early validation (before saving)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Define the upload folder (equivalent to PHP's UPLOAD_FOLDER)
      const uploadFolder = path.resolve(__dirname);
      
      // Define the upload path based on mediaPath (equivalent to PHP's UPLOAD_PATH)
      let uploadPath = '';
      if (req.body.mediaPath) {
        uploadPath = sanitizeFileName(req.body.mediaPath);
      }
      
      // Store these values for later use when responding
      req.uploadFolder = uploadFolder;
      req.uploadPath = uploadPath;
      
      // Create the full destination path
      const fullDestPath = path.join(uploadFolder, uploadPath);
      
      // Ensure directory exists (no direct equivalent in the PHP version)
      fs.mkdirSync(fullDestPath, { recursive: true });
      
      cb(null, fullDestPath);
    },
    filename: (req, file, cb) => {
      const sanitizedName = sanitizeFileName(file.originalname);
      if (!sanitizedName) {
        return cb(new Error('Invalid filename!'));
      }
      
      // Store original filename for response calculation
      req.originalFileName = sanitizedName;
      
      cb(null, sanitizedName);
    }
  }),
  fileFilter: (req, file, cb) => {
    try {
      // Get extension (equivalent to PHP's substr logic)
      const extension = path.extname(file.originalname).substring(1).toLowerCase();
      
      // Validate the extension (equivalent to PHP logic)
      validateExtension(extension);
      
      cb(null, true);
    } catch (err) {
      cb(err, false);
    }
  }
});

// Route handler for file uploads
router.post('/upload', (req, res) => {
  // Process the upload
  upload.single('file')(req, res, (err) => {
    if (err) {
      return showError(res, err.message);
    }
    
    // Check if file exists
    if (!req.file) {
      return showError(res, 'Invalid filename!');
    }

    // Determine the response (matching PHP's logic exactly)
    if (req.body.onlyFilename) {
      // Just return the filename as in the PHP version
      return res.send(req.file.filename);
    } else {
      // Return upload path + filename, using forward slashes for consistency with PHP
      // Using path.posix ensures forward slashes regardless of OS
      const relativePath = req.uploadPath ? req.uploadPath + '/' : '';
      return res.send(relativePath + req.file.filename);
    }
  });
});

module.exports = router;
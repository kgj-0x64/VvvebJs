const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Constants - matching PHP definitions
const MAX_FILE_LIMIT = 1024 * 1024 * 2; // 2 Megabytes max html file size
const ALLOW_PHP = false; // check if saved html contains php tag and don't save if not allowed
const ALLOWED_OEMBED_DOMAINS = [
  'https://www.youtube.com/',
  'https://www.vimeo.com/',
  'https://www.x.com/',
  'https://x.com/',
  'https://publish.twitter.com/',
  'https://www.twitter.com/',
  'https://www.reddit.com/',
]; // load urls only from allowed websites for oembed

/**
 * Error response helper function (equivalent to PHP's showError)
 */
function showError(res, error) {
  res.status(500).send(error);
}

/**
 * Sanitizes a filename to prevent security issues
 * Direct port of the PHP sanitizeFileName function
 */
function sanitizeFileName(file, allowedExtension = 'html') {
  if (!file) return '';
  
  // Get basename (filename without path)
  const basename = path.basename(file);
  
  // Check disallowed filenames
  const disallow = ['.htaccess', 'passwd'];
  if (disallow.includes(basename)) {
    throw new Error('Filename not allowed!');
  }
  
  // Sanitize: remove GET parameters, double dots, and invalid characters
  let sanitized = file
    .replace(/\?.*$/, '')                // Remove GET parameters
    .replace(/\.{2,}/g, '')              // Remove double dots
    .replace(/[^\/\\a-zA-Z0-9\-\._]/g, ''); // Remove invalid chars
  
  if (!sanitized) {
    return '';
  }
  
  // Add directory prefix (__DIR__ equivalent)
  sanitized = path.join(__dirname, sanitized);
  
  // Force allowed extension
  if (allowedExtension) {
    // Remove existing extension and add the allowed one
    sanitized = sanitized.replace(/\.[^.]+$/, '') + '.' + allowedExtension;
  }
  
  return sanitized;
}

/**
 * Validates if a URL is from an allowed oembed domain
 */
function validOembedUrl(url) {
  for (const domain of ALLOWED_OEMBED_DOMAINS) {
    if (url.startsWith(domain)) {
      return true;
    }
  }
  return false;
}

// Route handler for saving HTML content
router.post('/save.php', (req, res) => {
  let html = '';
  let file = '';

  try {
    // Handle template URL if present
    if (req.body.startTemplateUrl && req.body.startTemplateUrl.trim()) {
      const startTemplateUrl = sanitizeFileName(req.body.startTemplateUrl);
      html = '';
      
      if (startTemplateUrl) {
        html = fs.readFileSync(startTemplateUrl, 'utf8');
      }
    } 
    // Otherwise use provided HTML
    else if (req.body.html) {
      // Limit size like PHP's substr
      html = req.body.html.substring(0, MAX_FILE_LIMIT);
      
      // Check for PHP code if not allowed
      if (!ALLOW_PHP) {
        const phpPattern = /<\?php|<\? |<\?=|<\s*script\s*language\s*=\s*"\s*php\s*"\s*>/;
        if (phpPattern.test(html)) {
          return showError(res, 'PHP not allowed!');
        }
      }
    }

    // Get file path
    if (req.body.file) {
      file = sanitizeFileName(req.body.file);
    }

    // Process save request
    if (html) {
      if (file) {
        const dir = path.dirname(file);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
          console.log(`${dir} folder does not exist`);
          try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`${dir} folder was created`);
          } catch (err) {
            return showError(res, `Error creating folder '${dir}'`);
          }
        }

        // Save the file
        try {
          fs.writeFileSync(file, html);
          res.send(`File saved '${file}'`);
        } catch (err) {
          return showError(res, `Error saving file '${file}'
Possible causes are missing write permission or incorrect file path!`);
        }
      } else {
        return showError(res, 'Filename is empty!');
      }
    } else {
      return showError(res, 'Html content is empty!');
    }
  } catch (err) {
    return showError(res, err.message);
  }
});

// Route handler for file actions (rename, delete, etc.)
router.post('/action/:action', (req, res) => {
  const action = req.params.action;
  let file = '';
  
  try {
    // Get file path if provided
    if (req.body.file) {
      file = sanitizeFileName(req.body.file);
    }
    
    // Process different actions
    switch (action) {
      case 'rename':
        const newfile = sanitizeFileName(req.body.newfile);
        if (file && newfile) {
          try {
            fs.renameSync(file, newfile);
            res.send(`File '${file}' renamed to '${newfile}'`);
          } catch (err) {
            showError(res, `Error renaming file '${file}' renamed to '${newfile}'`);
          }
        }
        break;
        
      case 'delete':
        if (file) {
          try {
            fs.unlinkSync(file);
            res.send(`File '${file}' deleted`);
          } catch (err) {
            showError(res, `Error deleting file '${file}'`);
          }
        }
        break;
        
      case 'saveReusable':
        // Block or section
        const type = req.body.type || false;
        const name = req.body.name || false;
        const html = req.body.html || false;
        
        if (type && name && html) {
          const file = sanitizeFileName(`${type}/${name}`);
          
          if (file) {
            const dir = path.dirname(file);
            if (!fs.existsSync(dir)) {
              console.log(`${dir} folder does not exist`);
              try {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`${dir} folder was created`);
              } catch (err) {
                return showError(res, `Error creating folder '${dir}'`);
              }
            }
            
            try {
              fs.writeFileSync(file, html);
              res.send(`File saved '${file}'`);
            } catch (err) {
              return showError(res, `Error saving file '${file}'
Possible causes are missing write permission or incorrect file path!`);
            }
          } else {
            return showError(res, 'Invalid filename!');
          }
        } else {
          return showError(res, 'Missing reusable element data!');
        }
        break;
        
      default:
        return showError(res, `Invalid action '${action}'!`);
    }
  } catch (err) {
    return showError(res, err.message);
  }
});

// Route handler for oembed proxy
router.get('/oembedProxy', async (req, res) => {
  try {
    const url = req.query.url || '';
    
    if (validOembedUrl(url)) {
      try {
        // Get user agent from request
        const userAgent = req.headers['user-agent'];
        
        // Make request with the same user agent
        const response = await fetch(url, {
          headers: {
            'User-Agent': userAgent
          }
        });

        const data = await response.json(); // Assuming JSON response

        // Set content type and send response
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
      } catch (err) {
        return showError(res, `Error fetching oembed content: ${err.message}`);
      }
    } else {
      return showError(res, 'Invalid url!');
    }
  } catch (err) {
    return showError(res, err.message);
  }
});

module.exports = router;
// editor.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const router = express.Router();

router.get('/editor', (req, res) => {
  const editorHtmlPath = path.join(__dirname, 'editor.html');
  let html = fs.readFileSync(editorHtmlPath, 'utf8');

  const htmlFiles = [
    ...glob.sync('my-pages/*.html'),
    ...glob.sync('demo/**/*.html'),
    ...glob.sync('demo/*.html')
  ];

  const filteredFiles = htmlFiles.filter(file =>
    !['new-page-blank-template.html', 'editor.html'].includes(path.basename(file))
  );

  const filesMeta = filteredFiles.map(file => {
    const filePath = path.normalize(file);
    const pathInfo = path.parse(filePath);

    let filename = pathInfo.name;
    const folder = pathInfo.dir.split(path.sep)[0]; // first folder
    const subfolder = pathInfo.dir.split(path.sep)[1] || ''; // subfolder if any

    if (filename === 'index' && subfolder) {
      filename = subfolder;
    }

    const url = filePath.replace(/\\/g, '/'); // Normalize for browser
    const name = filename;
    const title = name.charAt(0).toUpperCase() + name.slice(1);

    return `{name:'${name}', file:'${file}', title:'${title}', url:'${url}', folder:'${folder}'}`;
  });

  const filesArrayString = filesMeta.join(',') + ',';
  html = html.replace('= defaultPages;', `= [${filesArrayString}];`);

  res.send(html);
});

module.exports = router;

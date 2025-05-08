const express = require('express');

const saveRoute = require('./server/save.js');
const editorRoute = require('./server/editor.js');
const scanRoute = require('./server/scan.js');
const uploadRoute = require('./server/upload.js');

const app = express();
const port = 8080;

// Serve static files from the directory where server.js is located
app.use(express.static(__dirname));

// Add these body parser middlewares BEFORE defining routes
app.use(express.json());                         // for parsing application/json
app.use(express.urlencoded({ extended: true, limit: "200mb" })); // for parsing application/x-www-form-urlencoded

/**
// Catch all other routes and redirect to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'editor.html'));
});

app.post('/save.php', (req, res) => {
  const { file, action, startTemplateUrl, html } = req.body;

  let result = "File saved!";
  fs.writeFileSync(file, html);
  
  try {
    fs.writeFileSync(file, html);
  } catch (err) {
    result = "Error saving file!";
    console.error(err);
  }

  res.send(result);
});
*/

// Mount the router
app.use('/', saveRoute);
app.use('/', editorRoute);
app.use('/', scanRoute);
app.use('/', uploadRoute);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
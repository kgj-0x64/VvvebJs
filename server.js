const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the directory where server.js is located
app.use(express.static(__dirname));

// Catch all other routes and redirect to index.html
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'editor.html'));
// });

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
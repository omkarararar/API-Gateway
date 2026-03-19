const express = require('express');

const createMockServer = (port, name) => {
  const app = express();
  
  app.use((req, res) => {
    console.log(`[Mock ${name}] Received ${req.method} request on ${req.url}`);
    
    res.json({
      message: `Hello from Mock ${name}!`,
      receivedUrl: req.url,
      receivedHeaders: req.headers, // This will show the injected X-Request-ID and X-User-ID
    });
  });

  app.listen(port, () => {
    console.log(`Mock ${name} listening on port ${port}`);
  });
};

// Start mock servers for all the target ports defined in your gateway.js
createMockServer(4000, 'Public API');
createMockServer(4001, 'Auth API');
createMockServer(4002, 'Products API');
createMockServer(4003, 'Admin API');

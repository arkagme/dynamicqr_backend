const app = require('./app');
const PORT = process.env.PORT || 3000;

// Only listen if this file is run directly (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the app as well (for flexibility)
module.exports = app;
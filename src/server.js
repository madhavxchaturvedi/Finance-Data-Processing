const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 8080;
const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Finance Dashboard API running on port ${PORT}`);
    console.log(`📚 Docs available at ${baseUrl}/api/docs`);
  });
});

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");

const app = express();
const port = 3000;

// CORS middleware
app.use(cors()); // This allows all origins

// Middleware to parse JSON bodies
app.use(express.json());

// Use auth routes
app.use("/api", authRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

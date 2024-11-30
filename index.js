/**
 * @fileoverview Main server application entry point
 * @requires express
 * @requires cors
 * @requires ./routes/auth
 * @requires ./routes/admin
 * @requires ./routes/staff
 * @requires ./routes/sponsorship
 * @requires ./routes/events
 * @requires ./config/database
 * @requires ./routes/streaming
 * @requires ./routes/artists
 */

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const staffRoutes = require("./routes/staff");
const sponsorshipRoutes = require("./routes/sponsorship");
const { connectToDB } = require("./config/database");
const streamingRoutes = require("./routes/streaming");
const artistRoutes = require("./routes/artists");

const app = express();
const port = 3000;

// Test database connection before starting server
async function startServer() {
  try {
    // Test the connection
    const connection = await connectToDB();
    console.log("Database connection successful");
    await connection.close();

    // CORS middleware
    app.use(cors());

    // Middleware to parse JSON bodies
    app.use(express.json());

    // Use auth routes
    app.use("/api", authRoutes);

    // Use admin routes
    app.use("/api/admin", adminRoutes);

    // Use staff routes
    app.use("/api/staff", staffRoutes);

    // Use sponsorship routes
    app.use("/api/sponsorships", sponsorshipRoutes);

    // Use streaming routes
    app.use("/api/streaming", streamingRoutes);

    // Use artist routes
    app.use("/api/artists", artistRoutes);

    // Start server
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  }
}

// Start the server
startServer();

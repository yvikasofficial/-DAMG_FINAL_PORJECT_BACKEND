/**
 * @fileoverview Streaming Platform management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Get all streaming platforms
 * @route GET /api/streaming
 * @returns {Array<Object>} List of streaming platforms
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT PLATFORM_ID, NAME, URL, STREAMING_DATE 
             FROM STREAMING_PLATFORMS 
             ORDER BY STREAMING_DATE`
    );

    const platforms = result.rows.map((row) => ({
      platformId: row[0],
      name: row[1],
      url: row[2],
      streamingDate: row[3],
    }));

    res.json(platforms);
  } catch (error) {
    console.error("Error retrieving streaming platforms:", error);
    res.status(500).json({ message: "Failed to retrieve streaming platforms" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});

/**
 * Get a specific streaming platform by ID
 * @route GET /api/streaming/:id
 * @param {number} req.params.id - Platform ID
 * @returns {Object} Platform details
 * @throws {Error} 404 - If platform not found
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/:id", async (req, res) => {
  let connection;
  try {
    const platformId = req.params.id;
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT PLATFORM_ID, NAME, URL, STREAMING_DATE 
             FROM STREAMING_PLATFORMS 
             WHERE PLATFORM_ID = :id`,
      [platformId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Streaming platform not found" });
    }

    const platform = {
      platformId: result.rows[0][0],
      name: result.rows[0][1],
      url: result.rows[0][2],
      streamingDate: result.rows[0][3],
    };

    res.json(platform);
  } catch (error) {
    console.error("Error retrieving streaming platform:", error);
    res.status(500).json({ message: "Failed to retrieve streaming platform" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});

/**
 * Create a new streaming platform
 * @route POST /api/streaming
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Platform name
 * @param {string} req.body.url - Platform URL
 * @param {string} req.body.streamingDate - Streaming date (YYYY-MM-DD)
 * @returns {Object} Created platform details
 * @throws {Error} 400 - If required fields are missing
 * @throws {Error} 500 - If creation fails
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const { name, url, streamingDate } = req.body;

    // Validate input
    if (!name || !url || !streamingDate) {
      return res.status(400).json({
        message: "Name, URL, and streaming date are required",
      });
    }

    connection = await connectToDB();

    // Get new platform ID
    const seqResult = await connection.execute(
      "SELECT PLATFORM_SEQ.NEXTVAL FROM DUAL"
    );
    const platformId = seqResult.rows[0][0];

    // Insert new platform
    await connection.execute(
      `INSERT INTO STREAMING_PLATFORMS (PLATFORM_ID, NAME, URL, STREAMING_DATE) 
             VALUES (:id, :name, :url, TO_DATE(:streamDate, 'YYYY-MM-DD'))`,
      {
        id: platformId,
        name: name,
        url: url,
        streamDate: streamingDate,
      },
      { autoCommit: true }
    );

    res.status(201).json({
      success: true,
      platformId: platformId,
      name: name,
      url: url,
      streamingDate: streamingDate,
    });
  } catch (error) {
    console.error("Platform creation error:", error);
    res.status(500).json({ message: "Failed to create streaming platform" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});

/**
 * Update a streaming platform
 * @route PUT /api/streaming/:id
 * @param {number} req.params.id - Platform ID to update
 * @param {Object} req.body - Fields to update
 * @returns {Object} Success message
 * @throws {Error} 404 - If platform not found
 * @throws {Error} 500 - If update fails
 */
router.put("/:id", async (req, res) => {
  let connection;
  try {
    const platformId = req.params.id;
    const { name, url, streamingDate } = req.body;

    connection = await connectToDB();

    // Check if platform exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM STREAMING_PLATFORMS WHERE PLATFORM_ID = :id",
      [platformId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Streaming platform not found" });
    }

    // Update platform
    await connection.execute(
      `UPDATE STREAMING_PLATFORMS 
             SET NAME = :name, 
                 URL = :url, 
                 STREAMING_DATE = TO_DATE(:streamDate, 'YYYY-MM-DD')
             WHERE PLATFORM_ID = :id`,
      {
        id: platformId,
        name: name,
        url: url,
        streamDate: streamingDate,
      },
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: "Streaming platform updated successfully",
    });
  } catch (error) {
    console.error("Platform update error:", error);
    res.status(500).json({ message: "Failed to update streaming platform" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});

/**
 * Delete a streaming platform
 * @route DELETE /api/streaming/:id
 * @param {number} req.params.id - Platform ID to delete
 * @returns {Object} Success message
 * @throws {Error} 404 - If platform not found
 * @throws {Error} 500 - If deletion fails
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const platformId = req.params.id;

    connection = await connectToDB();

    // Check if platform exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM STREAMING_PLATFORMS WHERE PLATFORM_ID = :id",
      [platformId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Streaming platform not found" });
    }

    // Delete platform
    await connection.execute(
      "DELETE FROM STREAMING_PLATFORMS WHERE PLATFORM_ID = :id",
      [platformId],
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: "Streaming platform deleted successfully",
    });
  } catch (error) {
    console.error("Platform deletion error:", error);
    res.status(500).json({ message: "Failed to delete streaming platform" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});

module.exports = router;

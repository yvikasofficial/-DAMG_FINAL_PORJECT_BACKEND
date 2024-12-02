/**
 * @fileoverview Streaming Platform management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");
const oracledb = require("oracledb");

/**
 * Get all streaming platforms
 * @route GET /api/streaming
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    // Using STREAMING_PACKAGE.LIST_ALL_STREAMING_PLATFORMS
    const result = await connection.execute(
      `DECLARE
        v_cursor STREAMING_PACKAGE.STREAMING_CURSOR;
       BEGIN
        STREAMING_PACKAGE.LIST_ALL_STREAMING_PLATFORMS(v_cursor);
        :cursor := v_cursor;
       END;`,
      {
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
      }
    );

    const resultSet = result.outBinds.cursor;
    const rows = await resultSet.getRows();
    await resultSet.close();

    const platforms = rows.map((row) => ({
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
 */
router.get("/:id", async (req, res) => {
  let connection;
  try {
    const platformId = req.params.id;
    connection = await connectToDB();

    // Using STREAMING_PACKAGE.GET_STREAMING_PLATFORM_DETAILS
    const result = await connection.execute(
      `DECLARE
        v_cursor STREAMING_PACKAGE.STREAMING_CURSOR;
       BEGIN
        v_cursor := STREAMING_PACKAGE.GET_STREAMING_PLATFORM_DETAILS(:id);
        :cursor := v_cursor;
       END;`,
      {
        id: platformId,
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
      }
    );

    const resultSet = result.outBinds.cursor;
    const rows = await resultSet.getRows();
    await resultSet.close();

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Streaming platform not found" });
    }

    const platform = {
      platformId: rows[0][0],
      name: rows[0][1],
      url: rows[0][2],
      streamingDate: rows[0][3],
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

    // Using STREAMING_PACKAGE.ADD_STREAMING_PLATFORM
    await connection.execute(
      `BEGIN
        STREAMING_PACKAGE.ADD_STREAMING_PLATFORM(:name, :url, TO_DATE(:streamDate, 'YYYY-MM-DD'));
       END;`,
      {
        name: name,
        url: url,
        streamDate: streamingDate,
      }
    );

    res.status(201).json({
      success: true,
      message: "Streaming platform created successfully",
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
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const platformId = req.params.id;
    connection = await connectToDB();

    // Using STREAMING_PACKAGE.DELETE_STREAMING_PLATFORM
    const result = await connection.execute(
      `DECLARE
        v_status VARCHAR2(200);
       BEGIN
        STREAMING_PACKAGE.DELETE_STREAMING_PLATFORM(:id, v_status);
        :status := v_status;
       END;`,
      {
        id: platformId,
        status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 200 },
      }
    );

    const status = result.outBinds.status || "";

    if (!status) {
      throw new Error("No status returned from delete operation");
    }

    if (status.includes("successfully")) {
      res.json({
        success: true,
        message: status,
      });
    } else if (status.includes("not found")) {
      res.status(404).json({ message: status });
    } else {
      res.status(500).json({ message: status });
    }
  } catch (error) {
    console.error("Platform deletion error:", error);
    res.status(500).json({
      message: "Failed to delete streaming platform",
      error: error.message,
    });
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

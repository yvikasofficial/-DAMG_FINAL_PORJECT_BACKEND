/**
 * @fileoverview Venue management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");
const oracledb = require("oracledb");

/**
 * Get all venues
 * @route GET /api/venues
 * @returns {Array<Object>} List of venues
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    // Using VENUES_PACKAGE.LIST_ALL_VENUES instead of direct SQL
    const result = await connection.execute(
      `DECLARE
        v_cursor VENUES_PACKAGE.VENUES_CURSOR;
       BEGIN
        VENUES_PACKAGE.LIST_ALL_VENUES(v_cursor);
        :cursor := v_cursor;
       END;`,
      {
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
      }
    );

    const resultSet = result.outBinds.cursor;
    const rows = await resultSet.getRows();
    await resultSet.close();

    const venues = rows.map((row) => ({
      venueId: row[0],
      name: row[1],
      location: row[2],
      capacity: row[3],
      availabilitySchedule: row[4],
      facilities: row[5],
    }));

    res.json(venues);
  } catch (error) {
    console.error("Error retrieving venues:", error);
    res.status(500).json({ message: "Failed to retrieve venues" });
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
 * Create a new venue
 * @route POST /api/venues
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Venue name
 * @param {string} req.body.location - Venue location
 * @param {number} req.body.capacity - Venue capacity
 * @param {string} req.body.availabilitySchedule - Venue availability schedule
 * @param {string} req.body.facilities - Venue facilities
 * @returns {Object} Created venue details
 * @throws {Error} 400 - If required fields are missing
 * @throws {Error} 500 - If creation fails
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const { name, location, capacity, availabilitySchedule, facilities } =
      req.body;

    // Validate required fields
    if (!name || !location || !capacity) {
      return res.status(400).json({
        message: "Name, location, and capacity are required",
      });
    }

    // Validate capacity is a positive number
    if (isNaN(capacity) || capacity <= 0) {
      return res.status(400).json({
        message: "Capacity must be a positive number",
      });
    }

    connection = await connectToDB();

    // Using VENUES_PACKAGE.ADD_VENUE instead of direct SQL
    await connection.execute(
      `BEGIN
        VENUES_PACKAGE.ADD_VENUE(
          :name, 
          :location, 
          :capacity, 
          :availabilitySchedule, 
          :facilities
        );
       END;`,
      {
        name: name,
        location: location,
        capacity: capacity,
        availabilitySchedule: availabilitySchedule || null,
        facilities: facilities || null,
      }
    );

    res.status(201).json({
      success: true,
      message: "Venue created successfully",
    });
  } catch (error) {
    console.error("Venue creation error:", error);
    res.status(500).json({ message: "Failed to create venue" });
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
 * Delete a venue
 * @route DELETE /api/venues/:id
 * @param {number} req.params.id - Venue ID to delete
 * @returns {Object} Success message
 * @throws {Error} 404 - If venue not found
 * @throws {Error} 500 - If deletion fails
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const venueId = req.params.id;
    connection = await connectToDB();

    // Using VENUES_PACKAGE.DELETE_VENUE instead of direct SQL
    const result = await connection.execute(
      `DECLARE
        v_status VARCHAR2(200);
       BEGIN
        VENUES_PACKAGE.DELETE_VENUE(:id, v_status);
        :status := v_status;
       END;`,
      {
        id: venueId,
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
    console.error("Venue deletion error:", error);
    res.status(500).json({
      message: "Failed to delete venue",
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

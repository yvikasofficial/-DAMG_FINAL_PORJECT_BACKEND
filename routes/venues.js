/**
 * @fileoverview Venue management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

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

    const result = await connection.execute(
      `SELECT 
                VENUE_ID, 
                NAME, 
                LOCATION, 
                CAPACITY, 
                AVAILABILITY_SCHEDULE, 
                FACILITIES 
             FROM VENUES 
             ORDER BY NAME`
    );

    const venues = result.rows.map((row) => ({
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

    // Get new venue ID
    const seqResult = await connection.execute(
      "SELECT VENUE_SEQ.NEXTVAL FROM DUAL"
    );
    const venueId = seqResult.rows[0][0];

    // Insert new venue
    await connection.execute(
      `INSERT INTO VENUES (
                VENUE_ID, 
                NAME, 
                LOCATION, 
                CAPACITY, 
                AVAILABILITY_SCHEDULE, 
                FACILITIES
            ) VALUES (
                :id, 
                :name, 
                :location, 
                :capacity, 
                :availabilitySchedule, 
                :facilities
            )`,
      {
        id: venueId,
        name: name,
        location: location,
        capacity: capacity,
        availabilitySchedule: availabilitySchedule || null,
        facilities: facilities || null,
      },
      { autoCommit: true }
    );

    res.status(201).json({
      success: true,
      venueId: venueId,
      name: name,
      location: location,
      capacity: capacity,
      availabilitySchedule: availabilitySchedule,
      facilities: facilities,
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

    // Check if venue exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM VENUES WHERE VENUE_ID = :id",
      [venueId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // Delete venue
    await connection.execute(
      "DELETE FROM VENUES WHERE VENUE_ID = :id",
      [venueId],
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: "Venue deleted successfully",
    });
  } catch (error) {
    console.error("Venue deletion error:", error);
    res.status(500).json({ message: "Failed to delete venue" });
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

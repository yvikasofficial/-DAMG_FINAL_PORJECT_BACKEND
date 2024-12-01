/**
 * @fileoverview Concert management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Get all concerts with related data
 * @route GET /api/concerts
 * @returns {Array<Object>} List of concerts with venue, artist, manager, and streaming info
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT 
                C.CONCERT_ID, 
                C.NAME AS CONCERT_NAME, 
                C.CONCERT_DATE,
                C.CONCERT_TIME,
                C.TICKET_SALES_LIMIT,
                C.STATUS,
                C.DESCRIPTION,
                V.VENUE_ID,
                V.NAME AS VENUE_NAME,
                V.LOCATION AS VENUE_LOCATION,
                A.ARTIST_ID,
                A.NAME AS ARTIST_NAME,
                A.GENRE,
                S.STAFF_ID AS MANAGER_ID,
                S.NAME AS MANAGER_NAME,
                SP.PLATFORM_ID,
                SP.NAME AS PLATFORM_NAME,
                SP.URL AS STREAMING_URL
             FROM CONCERTS C
             LEFT JOIN VENUES V ON C.VENUE_ID = V.VENUE_ID
             LEFT JOIN ARTISTS A ON C.ARTIST_ID = A.ARTIST_ID
             LEFT JOIN STAFF S ON C.MANAGER_ID = S.STAFF_ID
             LEFT JOIN STREAMING_PLATFORMS SP ON C.STREAMING_ID = SP.PLATFORM_ID
             ORDER BY C.CONCERT_DATE, C.CONCERT_TIME`
    );

    const concerts = result.rows.map((row) => ({
      concertId: row[0],
      name: row[1],
      date: row[2],
      time: row[3],
      ticketSalesLimit: row[4],
      status: row[5],
      description: row[6],
      venue: {
        venueId: row[7],
        name: row[8],
        location: row[9],
      },
      artist: {
        artistId: row[10],
        name: row[11],
        genre: row[12],
      },
      manager: {
        managerId: row[13],
        name: row[14],
      },
      streaming: {
        platformId: row[15],
        name: row[16],
        url: row[17],
      },
    }));

    res.json(concerts);
  } catch (error) {
    console.error("Error retrieving concerts:", error);
    res.status(500).json({ message: "Failed to retrieve concerts" });
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
 * Create a new concert
 * @route POST /api/concerts
 * @param {Object} req.body - Concert details
 * @returns {Object} Created concert details
 * @throws {Error} 400 - If required fields are missing or invalid
 * @throws {Error} 404 - If referenced entities not found
 * @throws {Error} 500 - If creation fails
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const {
      name,
      date,
      time,
      venueId,
      ticketSalesLimit,
      status,
      managerId,
      artistId,
      description,
      streamingId,
    } = req.body;

    // Validate required fields
    if (!name || !date || !time || !venueId || !managerId || !artistId) {
      return res.status(400).json({
        message: "Name, date, time, venue, manager, and artist are required",
      });
    }

    // Validate status
    const validStatuses = ["Scheduled", "Completed", "Canceled"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Must be Scheduled, Completed, or Canceled",
      });
    }

    connection = await connectToDB();

    // Verify venue exists
    const venueCheck = await connection.execute(
      "SELECT 1 FROM VENUES WHERE VENUE_ID = :id",
      [venueId]
    );
    if (venueCheck.rows.length === 0) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // Verify artist exists
    const artistCheck = await connection.execute(
      "SELECT 1 FROM ARTISTS WHERE ARTIST_ID = :id",
      [artistId]
    );
    if (artistCheck.rows.length === 0) {
      return res.status(404).json({ message: "Artist not found" });
    }

    // Verify manager exists
    const managerCheck = await connection.execute(
      "SELECT 1 FROM STAFF WHERE STAFF_ID = :id",
      [managerId]
    );
    if (managerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Manager not found" });
    }

    // Get new concert ID
    const seqResult = await connection.execute(
      "SELECT CONCERT_SEQ.NEXTVAL FROM DUAL"
    );
    const concertId = seqResult.rows[0][0];

    // Insert new concert
    await connection.execute(
      `INSERT INTO CONCERTS (
                CONCERT_ID, 
                NAME, 
                CONCERT_DATE,
                CONCERT_TIME,
                VENUE_ID,
                TICKET_SALES_LIMIT,
                STATUS,
                MANAGER_ID,
                ARTIST_ID,
                DESCRIPTION,
                STREAMING_ID
            ) VALUES (
                :id,
                :name,
                TO_DATE(:date, 'YYYY-MM-DD'),
                :time,
                :venueId,
                :ticketLimit,
                :status,
                :managerId,
                :artistId,
                :description,
                :streamingId
            )`,
      {
        id: concertId,
        name: name,
        date: date,
        time: time,
        venueId: venueId,
        ticketLimit: ticketSalesLimit || 0,
        status: status || "Scheduled",
        managerId: managerId,
        artistId: artistId,
        description: description || null,
        streamingId: streamingId || null,
      },
      { autoCommit: true }
    );

    // Fetch the created concert with all related data
    const result = await connection.execute(
      `SELECT 
                C.CONCERT_ID, 
                C.NAME AS CONCERT_NAME,
                C.CONCERT_DATE,
                C.CONCERT_TIME,
                C.TICKET_SALES_LIMIT,
                C.STATUS,
                C.DESCRIPTION,
                V.VENUE_ID,
                V.NAME AS VENUE_NAME,
                A.ARTIST_ID,
                A.NAME AS ARTIST_NAME,
                S.STAFF_ID AS MANAGER_ID,
                S.NAME AS MANAGER_NAME
             FROM CONCERTS C
             JOIN VENUES V ON C.VENUE_ID = V.VENUE_ID
             JOIN ARTISTS A ON C.ARTIST_ID = A.ARTIST_ID
             JOIN STAFF S ON C.MANAGER_ID = S.STAFF_ID
             WHERE C.CONCERT_ID = :id`,
      [concertId]
    );

    const concert = {
      concertId: result.rows[0][0],
      name: result.rows[0][1],
      date: result.rows[0][2],
      time: result.rows[0][3],
      ticketSalesLimit: result.rows[0][4],
      status: result.rows[0][5],
      description: result.rows[0][6],
      venue: {
        venueId: result.rows[0][7],
        name: result.rows[0][8],
      },
      artist: {
        artistId: result.rows[0][9],
        name: result.rows[0][10],
      },
      manager: {
        managerId: result.rows[0][11],
        name: result.rows[0][12],
      },
    };

    res.status(201).json({
      success: true,
      ...concert,
    });
  } catch (error) {
    console.error("Concert creation error:", error);
    res.status(500).json({ message: "Failed to create concert" });
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
 * Delete a concert
 * @route DELETE /api/concerts/:id
 * @param {number} req.params.id - Concert ID to delete
 * @returns {Object} Success message
 * @throws {Error} 404 - If concert not found
 * @throws {Error} 500 - If deletion fails
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.id;

    connection = await connectToDB();

    // Check if concert exists
    const checkResult = await connection.execute(
      "SELECT STATUS FROM CONCERTS WHERE CONCERT_ID = :id",
      [concertId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Concert not found" });
    }

    // Don't allow deletion of completed concerts
    if (checkResult.rows[0][0] === "Completed") {
      return res.status(400).json({
        message: "Cannot delete a completed concert",
      });
    }

    // Delete concert
    await connection.execute(
      "DELETE FROM CONCERTS WHERE CONCERT_ID = :id",
      [concertId],
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: "Concert deleted successfully",
    });
  } catch (error) {
    console.error("Concert deletion error:", error);
    res.status(500).json({ message: "Failed to delete concert" });
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

/**
 * @fileoverview Concert management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");
const oracledb = require("oracledb");

// Configure oracledb to fetch CLOBs as strings
oracledb.fetchAsString = [oracledb.CLOB];

/**
 * Get all concerts
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    // First query: Get all concert data except description
    const result = await connection.execute(
      `SELECT 
                C.CONCERT_ID, 
                C.NAME, 
                TO_CHAR(C.CONCERT_DATE, 'YYYY-MM-DD') AS CONCERT_DATE,
                C.CONCERT_TIME,
                C.TICKET_SALES_LIMIT,
                C.STATUS,
                C.CREATED_DATE,
                C.DESCRIPTION,
                V.NAME AS VENUE_NAME,
                V.LOCATION AS VENUE_LOCATION,
                A.NAME AS ARTIST_NAME,
                A.GENRE AS ARTIST_GENRE,
                S.NAME AS MANAGER_NAME,
                SP.NAME AS PLATFORM_NAME
            FROM CONCERTS C
            LEFT JOIN VENUES V ON C.VENUE_ID = V.VENUE_ID
            LEFT JOIN ARTISTS A ON C.ARTIST_ID = A.ARTIST_ID
            LEFT JOIN STAFF S ON C.MANAGER_ID = S.STAFF_ID
            LEFT JOIN STREAMING_PLATFORMS SP ON C.STREAMING_ID = SP.PLATFORM_ID
            ORDER BY C.CONCERT_DATE DESC`,
      [],
      { fetchInfo: { DESCRIPTION: { type: oracledb.STRING } } }
    );

    const concerts = result.rows.map((row) => ({
      id: row[0],
      name: row[1],
      date: row[2],
      time: row[3],
      ticketSalesLimit: row[4],
      status: row[5],
      createdDate: row[6],
      description: row[7],
      venue: {
        name: row[8],
        location: row[9],
      },
      artist: {
        name: row[10],
        genre: row[11],
      },
      manager: {
        name: row[12],
      },
      streaming: {
        platform: row[13],
      },
    }));

    res.json(concerts);
  } catch (error) {
    console.error("Error:", error);
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
 * Get concert by ID using CONCERT_FULL_DETAILS view
 */
router.get("/:id", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.id;
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT * FROM CONCERT_FULL_DETAILS 
             WHERE CONCERT_ID = :id`,
      [concertId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Concert not found" });
    }

    const row = result.rows[0];
    const concert = {
      id: row[0],
      name: row[1],
      date: row[2],
      time: row[3],
      status: row[4],
      venue: {
        name: row[5],
        location: row[6],
        capacity: row[7],
      },
      ticketSalesLimit: row[8],
      remainingCapacity: row[9],
      artist: {
        name: row[10],
        genre: row[11],
      },
      manager: {
        name: row[12],
      },
      ratings: {
        average: row[13],
        totalFeedbacks: row[14],
      },
    };

    res.json(concert);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to retrieve concert" });
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
 * Create new concert
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
        message: "Missing required fields",
      });
    }

    connection = await connectToDB();

    // Get new sequence value
    const seqResult = await connection.execute(
      "SELECT CONCERT_SEQ.NEXTVAL FROM DUAL"
    );
    const concertId = seqResult.rows[0][0];

    // Insert new concert using snake_case bind variables
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
                :concert_id,
                :name,
                TO_DATE(:concert_date, 'YYYY-MM-DD'),
                :concert_time,
                :venue_id,
                :ticket_sales_limit,
                :status,
                :manager_id,
                :artist_id,
                :description,
                :streaming_id
            )`,
      {
        concert_id: concertId,
        name: name,
        concert_date: date,
        concert_time: time,
        venue_id: venueId,
        ticket_sales_limit: ticketSalesLimit || 0,
        status: status || "Scheduled",
        manager_id: managerId,
        artist_id: artistId,
        description: description || null,
        streaming_id: streamingId || null,
      },
      { autoCommit: true }
    );

    // Return the created concert
    const result = await connection.execute(
      `SELECT 
                C.CONCERT_ID, 
                C.NAME, 
                TO_CHAR(C.CONCERT_DATE, 'YYYY-MM-DD') AS CONCERT_DATE,
                C.CONCERT_TIME,
                C.TICKET_SALES_LIMIT,
                C.STATUS,
                C.DESCRIPTION,
                V.NAME AS VENUE_NAME,
                A.NAME AS ARTIST_NAME,
                S.NAME AS MANAGER_NAME
            FROM CONCERTS C
            LEFT JOIN VENUES V ON C.VENUE_ID = V.VENUE_ID
            LEFT JOIN ARTISTS A ON C.ARTIST_ID = A.ARTIST_ID
            LEFT JOIN STAFF S ON C.MANAGER_ID = S.STAFF_ID
            WHERE C.CONCERT_ID = :concert_id`,
      { concert_id: concertId }
    );

    const concert = {
      id: result.rows[0][0],
      name: result.rows[0][1],
      date: result.rows[0][2],
      time: result.rows[0][3],
      ticketSalesLimit: result.rows[0][4],
      status: result.rows[0][5],
      description: result.rows[0][6],
      venue: { name: result.rows[0][7] },
      artist: { name: result.rows[0][8] },
      manager: { name: result.rows[0][9] },
    };

    res.status(201).json(concert);
  } catch (error) {
    console.error("Error:", error);
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
 * Update concert
 */
router.put("/:id", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.id;
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

    connection = await connectToDB();

    // Check if concert exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM CONCERTS WHERE CONCERT_ID = :concert_id",
      { concert_id: concertId }
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Concert not found" });
    }

    // Update concert using snake_case bind variables
    await connection.execute(
      `UPDATE CONCERTS SET
                NAME = :name,
                CONCERT_DATE = TO_DATE(:concert_date, 'YYYY-MM-DD'),
                CONCERT_TIME = :concert_time,
                VENUE_ID = :venue_id,
                TICKET_SALES_LIMIT = :ticket_sales_limit,
                STATUS = :status,
                MANAGER_ID = :manager_id,
                ARTIST_ID = :artist_id,
                DESCRIPTION = :description,
                STREAMING_ID = :streaming_id
            WHERE CONCERT_ID = :concert_id`,
      {
        concert_id: concertId,
        name: name,
        concert_date: date,
        concert_time: time,
        venue_id: venueId,
        ticket_sales_limit: ticketSalesLimit,
        status: status,
        manager_id: managerId,
        artist_id: artistId,
        description: description,
        streaming_id: streamingId,
      },
      { autoCommit: true }
    );

    // Fetch updated concert with related data
    const result = await connection.execute(
      `SELECT 
                C.CONCERT_ID, 
                C.NAME, 
                TO_CHAR(C.CONCERT_DATE, 'YYYY-MM-DD') AS CONCERT_DATE,
                C.CONCERT_TIME,
                C.TICKET_SALES_LIMIT,
                C.STATUS,
                C.DESCRIPTION,
                V.NAME AS VENUE_NAME,
                A.NAME AS ARTIST_NAME,
                S.NAME AS MANAGER_NAME
            FROM CONCERTS C
            LEFT JOIN VENUES V ON C.VENUE_ID = V.VENUE_ID
            LEFT JOIN ARTISTS A ON C.ARTIST_ID = A.ARTIST_ID
            LEFT JOIN STAFF S ON C.MANAGER_ID = S.STAFF_ID
            WHERE C.CONCERT_ID = :concert_id`,
      { concert_id: concertId }
    );

    const concert = {
      id: result.rows[0][0],
      name: result.rows[0][1],
      date: result.rows[0][2],
      time: result.rows[0][3],
      ticketSalesLimit: result.rows[0][4],
      status: result.rows[0][5],
      description: result.rows[0][6],
      venue: { name: result.rows[0][7] },
      artist: { name: result.rows[0][8] },
      manager: { name: result.rows[0][9] },
    };

    res.json(concert);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to update concert" });
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
 * Delete concert
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.id;
    connection = await connectToDB();

    // Check if concert exists and get its status
    const checkResult = await connection.execute(
      "SELECT STATUS FROM CONCERTS WHERE CONCERT_ID = :id",
      [concertId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Concert not found",
      });
    }

    // Don't allow deletion of completed concerts
    if (checkResult.rows[0][0] === "Completed") {
      return res.status(400).json({
        success: false,
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
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete concert",
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

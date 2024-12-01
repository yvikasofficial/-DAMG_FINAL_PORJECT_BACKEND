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

    const result = await connection.execute(
      `SELECT * FROM CONCERT_FULL_DETAILS 
             ORDER BY CONCERT_DATE DESC`
    );

    const concerts = result.rows.map((row) => ({
      id: row[0],
      name: row[1],
      date: row[2],
      time: row[3],
      status: row[4],
      price: row[5],
      description: row[6],
      venue: {
        id: row[7],
        name: row[8],
        location: row[9],
        capacity: row[10],
      },
      ticketSalesLimit: row[11],
      remainingCapacity: row[12],
      artist: {
        id: row[13],
        name: row[14],
        genre: row[15],
      },
      manager: {
        id: row[16],
        name: row[17],
      },
      ratings: {
        average: row[18],
        totalFeedbacks: row[19],
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
 * Get concert by ID
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
      price: row[5],
      description: row[6],
      venue: {
        id: row[7],
        name: row[8],
        location: row[9],
        capacity: row[10],
      },
      ticketSalesLimit: row[11],
      remainingCapacity: row[12],
      artist: {
        id: row[13],
        name: row[14],
        genre: row[15],
      },
      manager: {
        id: row[16],
        name: row[17],
      },
      ratings: {
        average: row[18],
        totalFeedbacks: row[19],
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
      artistId,
      managerId,
      ticketSalesLimit,
      price, // Added price
      description,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !date ||
      !time ||
      !venueId ||
      !artistId ||
      !managerId ||
      !ticketSalesLimit ||
      !price
    ) {
      return res.status(400).json({
        message:
          "Name, date, time, venue ID, artist ID, manager ID, ticket sales limit, and price are required",
      });
    }

    // Validate price
    if (price <= 0) {
      return res.status(400).json({
        message: "Price must be greater than 0",
      });
    }

    connection = await connectToDB();

    // Get new sequence value
    const seqResult = await connection.execute(
      "SELECT CONCERT_SEQ.NEXTVAL FROM DUAL"
    );
    const concertId = seqResult.rows[0][0];

    // Insert concert
    await connection.execute(
      `INSERT INTO CONCERTS (
                CONCERT_ID,
                NAME,
                CONCERT_DATE,
                CONCERT_TIME,
                VENUE_ID,
                ARTIST_ID,
                MANAGER_ID,
                TICKET_SALES_LIMIT,
                PRICE,
                DESCRIPTION,
                STATUS
            ) VALUES (
                :concert_id,
                :name,
                TO_DATE(:date, 'YYYY-MM-DD'),
                :time,
                :venue_id,
                :artist_id,
                :manager_id,
                :ticket_limit,
                :price,
                :description,
                'Scheduled'
            )`,
      {
        concert_id: concertId,
        name: name,
        date: date,
        time: time,
        venue_id: venueId,
        artist_id: artistId,
        manager_id: managerId,
        ticket_limit: ticketSalesLimit,
        price: price,
        description: description || null,
      },
      { autoCommit: true }
    );

    // Get the created concert
    const result = await connection.execute(
      `SELECT * FROM CONCERT_FULL_DETAILS WHERE CONCERT_ID = :id`,
      [concertId]
    );

    const row = result.rows[0];
    const concert = {
      id: row[0],
      name: row[1],
      date: row[2],
      time: row[3],
      status: row[4],
      price: row[5],
      venue: {
        name: row[6],
        location: row[7],
        capacity: row[8],
      },
      ticketSalesLimit: row[9],
      remainingCapacity: row[10],
      artist: {
        name: row[11],
        genre: row[12],
      },
      manager: {
        name: row[13],
      },
      ratings: {
        average: row[14],
        totalFeedbacks: row[15],
      },
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
      artistId,
      managerId,
      ticketSalesLimit,
      price,
      status,
      description,
    } = req.body;

    connection = await connectToDB();

    // Check if concert exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM CONCERTS WHERE CONCERT_ID = :id",
      [concertId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Concert not found" });
    }

    // Validate price if provided
    if (price !== undefined && price <= 0) {
      return res.status(400).json({
        message: "Price must be greater than 0",
      });
    }

    // Update concert
    const updateQuery = `
      UPDATE CONCERTS SET
        NAME = :name,
        CONCERT_DATE = TO_DATE(:concertdate, 'YYYY-MM-DD'),
        CONCERT_TIME = :concerttime,
        VENUE_ID = :venueid,
        ARTIST_ID = :artistid,
        MANAGER_ID = :managerid,
        TICKET_SALES_LIMIT = :ticketlimit,
        PRICE = :price,
        STATUS = :status,
        DESCRIPTION = :description
      WHERE CONCERT_ID = :id
    `;

    await connection.execute(
      updateQuery,
      {
        name: name || null,
        concertdate: date || null,
        concerttime: time || null,
        venueid: venueId || null,
        artistid: artistId || null,
        managerid: managerId || null,
        ticketlimit: ticketSalesLimit || null,
        price: price || null,
        status: status || null,
        description: description || null,
        id: concertId,
      },
      { autoCommit: true }
    );

    // Get updated concert
    const result = await connection.execute(
      `SELECT * FROM CONCERT_FULL_DETAILS WHERE CONCERT_ID = :id`,
      [concertId]
    );

    const row = result.rows[0];
    const concert = {
      id: row[0],
      name: row[1],
      date: row[2],
      time: row[3],
      status: row[4],
      price: row[5],
      venue: {
        id: row[6],
        name: row[7],
        location: row[8],
        capacity: row[9],
      },
      ticketSalesLimit: row[10],
      remainingCapacity: row[11],
      artist: {
        id: row[12],
        name: row[13],
        genre: row[14],
      },
      manager: {
        id: row[15],
        name: row[16],
      },
      ratings: {
        average: row[17],
        totalFeedbacks: row[18],
      },
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

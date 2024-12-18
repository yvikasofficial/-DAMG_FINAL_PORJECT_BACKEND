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
 * Helper function to fetch data from cursor
 * @param {oracledb.ResultSet} cursor - Oracle cursor to fetch data from
 * @returns {Promise<Array>} Array of rows from the cursor
 */
async function fetchCursorData(cursor) {
  const rows = [];
  try {
    let row;
    while ((row = await cursor.getRow())) {
      rows.push(row);
    }
  } finally {
    if (cursor && !cursor.isClosed) {
      await cursor.close();
    }
  }
  return rows;
}

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
      price,
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
        message: "All fields are required except description",
      });
    }

    connection = await connectToDB();

    // Get new concert ID
    const seqResult = await connection.execute(
      "SELECT CONCERT_SEQ.NEXTVAL FROM DUAL"
    );
    const concertId = seqResult.rows[0][0];

    // Create concert
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
        STATUS,
        DESCRIPTION
      ) VALUES (
        :concertid,
        :concertname,
        TO_DATE(:concertdate, 'YYYY-MM-DD'),
        :concerttime,
        :venueid,
        :artistid,
        :managerid,
        :ticketlimit,
        :price,
        'Scheduled',
        :description
      )`,
      {
        concertid: concertId,
        concertname: name,
        concertdate: date,
        concerttime: time,
        venueid: venueId,
        artistid: artistId,
        managerid: managerId,
        ticketlimit: ticketSalesLimit,
        price: price,
        description: description || null,
      },
      { autoCommit: true }
    );

    // Get created concert
    const result = await connection.execute(
      `SELECT * FROM CONCERT_FULL_DETAILS WHERE CONCERT_ID = :id`,
      { id: concertId }
    );

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

    // Call the procedure to delete concert and tickets
    const result = await connection.execute(
      `BEGIN
        DELETE_CONCERT_AND_TICKETS(:id, :status);
      END;`,
      {
        id: concertId,
        status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 200 },
      }
    );

    const deleteStatus = result.outBinds.status;

    if (deleteStatus.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: deleteStatus,
      });
    }

    if (deleteStatus.includes("Cannot delete")) {
      return res.status(400).json({
        success: false,
        message: deleteStatus,
      });
    }

    if (deleteStatus.includes("Error:")) {
      throw new Error(deleteStatus);
    }

    res.json({
      success: true,
      message: deleteStatus,
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

/**
 * Get concert revenue
 */
router.get("/:id/revenue", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.id;
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT CALCULATE_CONCERT_REVENUE(:id) as REVENUE FROM DUAL`,
      { id: concertId }
    );

    const revenue = result.rows[0][0];
    res.json({ revenue });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to calculate revenue" });
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
 * Update concert price
 */
router.put("/:id/price", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.id;
    const { priceIncrease } = req.body;

    if (priceIncrease === undefined) {
      return res.status(400).json({
        message: "Price increase amount is required",
      });
    }

    connection = await connectToDB();

    // Execute the price update procedure
    const result = await connection.execute(
      `DECLARE
                v_result VARCHAR2(200);
             BEGIN
                UPDATE_CONCERT_PRICES(:id, :increase, v_result);
                :result := v_result;
             END;`,
      {
        id: concertId,
        increase: priceIncrease,
        result: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 200 },
      }
    );

    const updateResult = result.outBinds.result;
    res.json({ message: updateResult });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to update price" });
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
 * Get concert summary
 */
router.get("/:id/summary", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.id;
    connection = await connectToDB();

    // Call the procedure
    const result = await connection.execute(
      `BEGIN
                GET_CONCERT_SUMMARY(
                    :id,
                    :name,
                    :date,
                    :time,
                    :price,
                    :ticketLimit,
                    :ticketsSold,
                    :sponsorCount,
                    :totalRevenue,
                    :isSoldOut
                );
            END;`,
      {
        id: concertId,
        name: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
        date: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
        time: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 8 },
        price: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        ticketLimit: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        ticketsSold: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        sponsorCount: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        totalRevenue: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        isSoldOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );

    const summary = {
      name: result.outBinds.name,
      date: result.outBinds.date,
      time: result.outBinds.time,
      currentPrice: result.outBinds.price,
      ticketLimit: result.outBinds.ticketLimit,
      ticketsSold: result.outBinds.ticketsSold,
      sponsorCount: result.outBinds.sponsorCount,
      totalRevenue: result.outBinds.totalRevenue,
      isSoldOut: result.outBinds.isSoldOut === 1,
    };

    res.json(summary);
  } catch (error) {
    console.error("Error:", error);
    if (error.errorNum === 20001) {
      res.status(404).json({ message: "Concert not found" });
    } else {
      res.status(500).json({ message: "Failed to generate summary" });
    }
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
 * Get attendee dashboard
 */
router.get("/attendee/:attendeeId/dashboard", async (req, res) => {
  let connection;
  try {
    const attendeeId = req.params.attendeeId;
    connection = await connectToDB();

    const result = await connection.execute(
      `BEGIN
        GET_ATTENDEE_DASHBOARD(
          :attendeeId,
          :upcomingTickets,
          :pastTickets,
          :stats
        );
      END;`,
      {
        attendeeId: attendeeId,
        upcomingTickets: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
        pastTickets: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
        stats: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
      }
    );

    // Fetch data from cursors
    const upcomingTicketsCursor = result.outBinds.upcomingTickets;
    const pastTicketsCursor = result.outBinds.pastTickets;
    const statsCursor = result.outBinds.stats;

    const upcomingTickets = await fetchCursorData(upcomingTicketsCursor);
    const pastTickets = await fetchCursorData(pastTicketsCursor);
    const statsData = await fetchCursorData(statsCursor);

    const dashboard = {
      attendee: {
        name: statsData[0]?.[0],
        loyaltyPoints: statsData[0]?.[1],
        totalTickets: statsData[0]?.[2],
        totalSpent: statsData[0]?.[3],
        totalReviews: statsData[0]?.[4],
        favoriteGenre: statsData[0]?.[5],
      },
      upcomingConcerts: upcomingTickets.map((row) => ({
        ticketId: row[0],
        price: row[1],
        purchaseDate: row[2],
        ticketStatus: row[3],
        concert: {
          id: row[4],
          name: row[5],
          date: row[6],
          time: row[7],
          status: row[8],
        },
        venue: {
          name: row[9],
          location: row[10],
        },
        artist: {
          name: row[11],
          genre: row[12],
        },
      })),
      pastConcerts: pastTickets.map((row) => ({
        ticketId: row[0],
        price: row[1],
        purchaseDate: row[2],
        ticketStatus: row[3],
        concert: {
          id: row[4],
          name: row[5],
          date: row[6],
          time: row[7],
          status: row[8],
        },
        venue: {
          name: row[9],
          location: row[10],
        },
        artist: {
          name: row[11],
          genre: row[12],
        },
        feedback: {
          rating: row[13],
          comment: row[14],
        },
      })),
    };

    res.json(dashboard);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to generate dashboard" });
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

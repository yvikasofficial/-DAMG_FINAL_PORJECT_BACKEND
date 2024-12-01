const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Get all tickets by AttendeeLD
 */
router.get("/attendee/:attendeeId", async (req, res) => {
  let connection;
  try {
    const attendeeId = req.params.attendeeId;
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT 
                T.TICKET_ID,
                T.PRICE,
                T.PURCHASE_DATE,
                T.STATUS,
                C.NAME AS CONCERT_NAME,
                C.CONCERT_DATE,
                C.CONCERT_TIME,
                V.NAME AS VENUE_NAME,
                V.LOCATION AS VENUE_LOCATION
            FROM TICKETS T
            JOIN CONCERTS C ON T.CONCERT_ID = C.CONCERT_ID
            JOIN VENUES V ON C.VENUE_ID = V.VENUE_ID
            WHERE T.ATTENDEELD = :id
            ORDER BY C.CONCERT_DATE DESC`,
      [attendeeId]
    );

    const tickets = result.rows.map((row) => ({
      id: row[0],
      price: row[1],
      purchaseDate: row[2],
      status: row[3],
      concert: {
        name: row[4],
        date: row[5],
        time: row[6],
        venue: {
          name: row[7],
          location: row[8],
        },
      },
    }));

    res.json(tickets);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to retrieve tickets" });
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
 * Get ticket for concert and AttendeeLD
 */
router.get("/concert/:concertId/attendee/:attendeeId", async (req, res) => {
  let connection;
  try {
    const { concertId, attendeeId } = req.params;
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT 
                T.TICKET_ID,
                T.PRICE,
                T.PURCHASE_DATE,
                T.STATUS,
                C.NAME AS CONCERT_NAME,
                C.CONCERT_DATE,
                C.CONCERT_TIME,
                V.NAME AS VENUE_NAME,
                V.LOCATION AS VENUE_LOCATION
            FROM TICKETS T
            JOIN CONCERTS C ON T.CONCERT_ID = C.CONCERT_ID
            JOIN VENUES V ON C.VENUE_ID = V.VENUE_ID
            WHERE T.CONCERT_ID = :concertId 
            AND T.ATTENDEELD = :attendeeId`,
      [concertId, attendeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const row = result.rows[0];
    const ticket = {
      id: row[0],
      price: row[1],
      purchaseDate: row[2],
      status: row[3],
      concert: {
        name: row[4],
        date: row[5],
        time: row[6],
        venue: {
          name: row[7],
          location: row[8],
        },
      },
    };

    res.json(ticket);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to retrieve ticket" });
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
 * Create new ticket
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const { concertId, attendeeId, price } = req.body;

    // Validate required fields
    if (!concertId || !attendeeId || !price) {
      return res.status(400).json({
        message: "Concert ID, Attendee ID, and Price are required",
      });
    }

    connection = await connectToDB();

    // Get new sequence value
    const seqResult = await connection.execute(
      "SELECT TICKET_SEQ.NEXTVAL FROM DUAL"
    );
    const ticketId = seqResult.rows[0][0];

    // Insert ticket
    await connection.execute(
      `INSERT INTO TICKETS (
                TICKET_ID,
                PRICE,
                CONCERT_ID,
                ATTENDEELD,
                STATUS
            ) VALUES (
                :ticket_id,
                :price,
                :concert_id,
                :attendee_id,
                'ACTIVE'
            )`,
      {
        ticket_id: ticketId,
        price: price,
        concert_id: concertId,
        attendee_id: attendeeId,
      },
      { autoCommit: true }
    );

    // Get the created ticket
    const result = await connection.execute(
      `SELECT 
                T.TICKET_ID,
                T.PRICE,
                T.PURCHASE_DATE,
                T.STATUS,
                C.NAME AS CONCERT_NAME
            FROM TICKETS T
            JOIN CONCERTS C ON T.CONCERT_ID = C.CONCERT_ID
            WHERE T.TICKET_ID = :id`,
      [ticketId]
    );

    const row = result.rows[0];
    const ticket = {
      id: row[0],
      price: row[1],
      purchaseDate: row[2],
      status: row[3],
      concertName: row[4],
    };

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to create ticket" });
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
 * Delete ticket
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const ticketId = req.params.id;
    connection = await connectToDB();

    // Check if ticket exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM TICKETS WHERE TICKET_ID = :id",
      [ticketId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Delete ticket
    await connection.execute(
      "DELETE FROM TICKETS WHERE TICKET_ID = :id",
      [ticketId],
      { autoCommit: true }
    );

    res.status(200).json({ message: "Ticket deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to delete ticket" });
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

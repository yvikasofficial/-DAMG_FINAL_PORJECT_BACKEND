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
    const { concertId, attendeeId } = req.body;

    // Validate required fields
    if (!concertId || !attendeeId) {
      return res.status(400).json({
        message: "Concert ID and Attendee ID are required",
      });
    }

    connection = await connectToDB();

    // Get concert price and check availability
    const concertCheck = await connection.execute(
      `SELECT 
                PRICE, 
                TICKET_SALES_LIMIT,
                (SELECT COUNT(*) FROM TICKETS WHERE CONCERT_ID = :concertId) as SOLD_TICKETS
            FROM CONCERTS 
            WHERE CONCERT_ID = :concertId`,
      { concertId: concertId }
    );

    if (concertCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Concert not found",
      });
    }

    const concertPrice = concertCheck.rows[0][0];
    const ticketLimit = concertCheck.rows[0][1];
    const soldTickets = concertCheck.rows[0][2];

    // Check if tickets are still available
    if (soldTickets >= ticketLimit) {
      return res.status(400).json({
        message: "Sorry, this concert is sold out",
      });
    }

    // Get new sequence value
    const seqResult = await connection.execute(
      "SELECT TICKET_SEQ.NEXTVAL FROM DUAL"
    );
    const ticketId = seqResult.rows[0][0];

    // Insert ticket with concert price
    await connection.execute(
      `INSERT INTO TICKETS (
                TICKET_ID,
                PRICE,
                CONCERT_ID,
                ATTENDEELD,
                STATUS
            ) VALUES (
                :ticketId,
                :price,
                :concertId,
                :attendeeId,
                'ACTIVE'
            )`,
      {
        ticketId: ticketId,
        price: concertPrice,
        concertId: concertId,
        attendeeId: attendeeId,
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
                C.NAME AS CONCERT_NAME,
                C.CONCERT_DATE,
                C.CONCERT_TIME,
                V.NAME AS VENUE_NAME,
                V.LOCATION AS VENUE_LOCATION
            FROM TICKETS T
            JOIN CONCERTS C ON T.CONCERT_ID = C.CONCERT_ID
            JOIN VENUES V ON C.VENUE_ID = V.VENUE_ID
            WHERE T.TICKET_ID = :ticketId`,
      { ticketId: ticketId }
    );

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

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Get feedback by concert ID
 */
router.get("/concert/:concertId", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.concertId;
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT 
                F.FEEDBACK_ID,
                F.CONCERT_ID,
                F.ATTENDEELD,
                F.RATING,
                F.COMMENTS,
                TO_CHAR(F.CREATED_DATE, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_DATE,
                A.NAME AS ATTENDEE_NAME,
                C.NAME AS CONCERT_NAME
            FROM FEEDBACK F
            JOIN ATTENDEE A ON F.ATTENDEELD = A.ATTENDEELD
            JOIN CONCERTS C ON F.CONCERT_ID = C.CONCERT_ID
            WHERE F.CONCERT_ID = :id
            ORDER BY F.CREATED_DATE DESC`,
      [concertId]
    );

    const feedback = result.rows.map((row) => ({
      id: row[0],
      concertId: row[1],
      attendeeId: row[2],
      rating: row[3],
      comments: row[4],
      createdDate: row[5],
      attendeeName: row[6],
      concertName: row[7],
    }));

    res.json(feedback);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to retrieve feedback" });
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
 * Create new feedback
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const { concertId, attendeeId, rating, comments } = req.body;

    // Validate required fields
    if (!concertId || !attendeeId || !rating) {
      return res.status(400).json({
        message: "Concert ID, Attendee ID, and Rating are required",
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5",
      });
    }

    connection = await connectToDB();

    // Check if concert exists and is completed
    const concertCheck = await connection.execute(
      `SELECT STATUS 
       FROM CONCERTS 
       WHERE CONCERT_ID = :concert_id`,
      [concertId]
    );

    if (concertCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Concert not found",
      });
    }

    // Get new sequence value
    const seqResult = await connection.execute(
      "SELECT FEEDBACK_SEQ.NEXTVAL FROM DUAL"
    );
    const feedbackId = seqResult.rows[0][0];

    // Insert feedback
    await connection.execute(
      `INSERT INTO FEEDBACK (
                FEEDBACK_ID,
                CONCERT_ID,
                ATTENDEELD,
                RATING,
                COMMENTS,
                CREATED_DATE
            ) VALUES (
                :feedback_id,
                :concert_id,
                :attendee_id,
                :rating,
                :comments,
                SYSDATE
            )`,
      {
        feedback_id: feedbackId,
        concert_id: concertId,
        attendee_id: attendeeId,
        rating: rating,
        comments: comments || null,
      },
      { autoCommit: true }
    );

    // Get the created feedback with related data
    const result = await connection.execute(
      `SELECT 
                F.FEEDBACK_ID,
                F.CONCERT_ID,
                F.ATTENDEELD,
                F.RATING,
                F.COMMENTS,
                TO_CHAR(F.CREATED_DATE, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_DATE,
                A.NAME AS ATTENDEE_NAME,
                C.NAME AS CONCERT_NAME
            FROM FEEDBACK F
            JOIN ATTENDEE A ON F.ATTENDEELD = A.ATTENDEELD
            JOIN CONCERTS C ON F.CONCERT_ID = C.CONCERT_ID
            WHERE F.FEEDBACK_ID = :id`,
      [feedbackId]
    );

    const feedback = {
      id: result.rows[0][0],
      concertId: result.rows[0][1],
      attendeeId: result.rows[0][2],
      rating: result.rows[0][3],
      comments: result.rows[0][4],
      createdDate: result.rows[0][5],
      attendeeName: result.rows[0][6],
      concertName: result.rows[0][7],
    };

    res.status(201).json(feedback);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to create feedback" });
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
 * Delete feedback
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const feedbackId = req.params.id;
    connection = await connectToDB();

    // Check if feedback exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM FEEDBACK WHERE FEEDBACK_ID = :id",
      [feedbackId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // Delete feedback
    await connection.execute(
      "DELETE FROM FEEDBACK WHERE FEEDBACK_ID = :id",
      [feedbackId],
      { autoCommit: true }
    );

    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to delete feedback" });
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

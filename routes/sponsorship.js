/**
 * @fileoverview Sponsorship management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Get all sponsorships
 * @route GET /api/sponsorships
 * @returns {Array<Object>} List of sponsorships
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT 
          S.SPONSOR_ID, 
          S.NAME, 
          S.CONTACT_INFO, 
          S.CONTRIBUTION_AMT,
          S.CONCERT_ID,
          C.NAME AS CONCERT_NAME,
          C.CONCERT_DATE
       FROM SPONSORSHIPS S
       JOIN CONCERTS C ON S.CONCERT_ID = C.CONCERT_ID`
    );

    const sponsorships = result.rows.map((row) => ({
      sponsorId: row[0],
      name: row[1],
      contactInfo: row[2],
      contributionAmt: row[3],
      concert: {
        id: row[4],
        name: row[5],
        date: row[6],
      },
    }));

    res.json(sponsorships);
  } catch (error) {
    console.error("Error retrieving sponsorships:", error);
    res.status(500).json({ message: "Failed to retrieve sponsorships" });
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
 * Get sponsorships by concert ID
 * @route GET /api/sponsorships/concert/:concertId
 * @param {number} req.params.concertId - Concert ID to filter sponsorships
 * @returns {Array<Object>} List of sponsorships
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/concert/:concertId", async (req, res) => {
  let connection;
  try {
    const concertId = req.params.concertId;
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT 
          S.SPONSOR_ID, 
          S.NAME, 
          S.CONTACT_INFO, 
          S.CONTRIBUTION_AMT,
          C.NAME AS CONCERT_NAME,
          C.CONCERT_DATE
       FROM SPONSORSHIPS S
       JOIN CONCERTS C ON S.CONCERT_ID = C.CONCERT_ID
       WHERE S.CONCERT_ID = :concertId`,
      { concertId }
    );

    const sponsorships = result.rows.map((row) => ({
      sponsorId: row[0],
      name: row[1],
      contactInfo: row[2],
      contributionAmt: row[3],
      concert: {
        name: row[4],
        date: row[5],
      },
    }));

    res.json(sponsorships);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to retrieve sponsorships" });
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
 * Create a new sponsorship
 * @route POST /api/sponsorships
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Sponsor name
 * @param {string} req.body.contactInfo - Sponsor contact information
 * @param {number} req.body.contributionAmt - Sponsorship amount
 * @param {number} req.body.concertId - Concert ID
 * @returns {Object} Created sponsorship details
 * @throws {Error} 400 - If required fields are missing
 * @throws {Error} 500 - If creation fails
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const { name, contactInfo, contributionAmt, concertId } = req.body;

    // Validate input
    if (!name || !contactInfo || !contributionAmt || !concertId) {
      return res.status(400).json({
        message:
          "Name, contact info, contribution amount, and concert ID are required",
      });
    }

    connection = await connectToDB();

    // Check if concert exists
    const concertCheck = await connection.execute(
      "SELECT 1 FROM CONCERTS WHERE CONCERT_ID = :concertId",
      { concertId }
    );

    if (concertCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Concert not found",
      });
    }

    // Get new sponsor ID
    const seqResult = await connection.execute(
      "SELECT SPONSOR_SEQ.NEXTVAL FROM DUAL"
    );
    const sponsorId = seqResult.rows[0][0];

    // Insert new sponsorship
    await connection.execute(
      `INSERT INTO SPONSORSHIPS (
          SPONSOR_ID, 
          NAME, 
          CONTACT_INFO, 
          CONTRIBUTION_AMT,
          CONCERT_ID
      ) VALUES (
          :id, 
          :name, 
          :contact, 
          :amount,
          :concertId
      )`,
      {
        id: sponsorId,
        name: name,
        contact: contactInfo,
        amount: contributionAmt,
        concertId: concertId,
      },
      { autoCommit: true }
    );

    // Get the created sponsorship with concert details
    const result = await connection.execute(
      `SELECT 
          S.SPONSOR_ID, 
          S.NAME, 
          S.CONTACT_INFO, 
          S.CONTRIBUTION_AMT,
          C.CONCERT_ID,
          C.NAME AS CONCERT_NAME,
          C.CONCERT_DATE
       FROM SPONSORSHIPS S
       JOIN CONCERTS C ON S.CONCERT_ID = C.CONCERT_ID
       WHERE S.SPONSOR_ID = :sponsorId`,
      { sponsorId }
    );

    const row = result.rows[0];
    const sponsorship = {
      sponsorId: row[0],
      name: row[1],
      contactInfo: row[2],
      contributionAmt: row[3],
      concert: {
        id: row[4],
        name: row[5],
        date: row[6],
      },
    };

    res.status(201).json(sponsorship);
  } catch (error) {
    console.error("Sponsorship creation error:", error);
    res.status(500).json({ message: "Failed to create sponsorship" });
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
 * Delete a sponsorship
 * @route DELETE /api/sponsorships/:id
 * @param {number} req.params.id - Sponsor ID to delete
 * @returns {Object} Success message
 * @throws {Error} 404 - If sponsorship not found
 * @throws {Error} 500 - If deletion fails
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const sponsorId = req.params.id;
    connection = await connectToDB();

    // Check if sponsorship exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM SPONSORSHIPS WHERE SPONSOR_ID = :id",
      [sponsorId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Sponsorship not found" });
    }

    // Delete sponsorship
    await connection.execute(
      "DELETE FROM SPONSORSHIPS WHERE SPONSOR_ID = :id",
      [sponsorId],
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: "Sponsorship deleted successfully",
    });
  } catch (error) {
    console.error("Sponsorship deletion error:", error);
    res.status(500).json({ message: "Failed to delete sponsorship" });
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

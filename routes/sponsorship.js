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
      `SELECT SPONSOR_ID, NAME, CONTACT_INFO, CONTRIBUTION_AMT 
             FROM SPONSORSHIPS`
    );

    const sponsorships = result.rows.map((row) => ({
      sponsorId: row[0],
      name: row[1],
      contactInfo: row[2],
      contributionAmt: row[3],
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
 * Create a new sponsorship
 * @route POST /api/sponsorships
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Sponsor name
 * @param {string} req.body.contactInfo - Sponsor contact information
 * @param {number} req.body.contributionAmt - Sponsorship amount
 * @returns {Object} Created sponsorship details
 * @throws {Error} 400 - If required fields are missing
 * @throws {Error} 500 - If creation fails
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const { name, contactInfo, contributionAmt } = req.body;

    // Validate input
    if (!name || !contactInfo || !contributionAmt) {
      return res.status(400).json({
        message: "Name, contact info, and contribution amount are required",
      });
    }

    connection = await connectToDB();

    // Get new sponsor ID
    const seqResult = await connection.execute(
      "SELECT SPONSOR_SEQ.NEXTVAL FROM DUAL"
    );
    const sponsorId = seqResult.rows[0][0];

    // Insert new sponsorship
    await connection.execute(
      `INSERT INTO SPONSORSHIPS (SPONSOR_ID, NAME, CONTACT_INFO, CONTRIBUTION_AMT) 
             VALUES (:id, :name, :contact, :amount)`,
      {
        id: sponsorId,
        name: name,
        contact: contactInfo,
        amount: contributionAmt,
      },
      { autoCommit: true }
    );

    res.status(201).json({
      success: true,
      sponsorId: sponsorId,
      name: name,
      contactInfo: contactInfo,
      contributionAmt: contributionAmt,
    });
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

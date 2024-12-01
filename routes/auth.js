const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Register a new attendee
 * @route POST /register
 * @param {Object} req.body
 * @param {string} req.body.name - The attendee's full name
 * @param {string} req.body.contactInfo - The attendee's contact information (email/phone)
 * @param {string} req.body.password - The attendee's password
 * @returns {Object} Message and attendeeId
 * @throws {500} If registration fails
 */
router.post("/register", async (req, res) => {
  let connection;
  try {
    const { name, contactInfo, phone, password } = req.body;

    // Validate required fields
    if (!name || !contactInfo || !password) {
      return res.status(400).json({
        message: "Name, contactInfo, and password are required",
      });
    }

    connection = await connectToDB();

    // Check if contactInfo already exists
    const contactCheck = await connection.execute(
      "SELECT 1 FROM ATTENDEE WHERE CONTACTINFO = :contactInfo",
      [contactInfo]
    );

    if (contactCheck.rows.length > 0) {
      return res.status(409).json({
        message:
          "Contact Info already in use. Please use a different contact info.",
      });
    }

    // Get new sequence value
    const seqResult = await connection.execute(
      "SELECT ATTENDEE_SEQ.NEXTVAL FROM DUAL"
    );
    const attendeeId = seqResult.rows[0][0];

    // Insert attendee
    await connection.execute(
      `INSERT INTO ATTENDEE (
        ATTENDEELD,
        NAME,
        CONTACTINFO,
        PHONE,
        PASSWORD
      ) VALUES (
        :attendee_id,
        :name,
        :contactInfo,
        :phone,
        :password
      )`,
      {
        attendee_id: attendeeId,
        name: name,
        contactInfo: contactInfo,
        phone: phone || null,
        password: password,
      },
      { autoCommit: true }
    );

    res.status(201).json({
      id: attendeeId,
      name,
      contactInfo,
      phone,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to register attendee" });
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
 * Login an existing attendee
 * @route POST /login
 * @param {Object} req.body
 * @param {string} req.body.contactInfo - The attendee's contact information
 * @param {string} req.body.password - The attendee's password
 * @returns {Object} Message and attendee details (id, name, contactInfo, loyaltyPoints)
 * @throws {401} If credentials are invalid
 * @throws {500} If login fails
 */
router.post("/login", async (req, res) => {
  try {
    const connection = await connectToDB();
    const { contactInfo, password } = req.body;

    const result = await connection.execute(
      `SELECT Attendeeld, Name, ContactInfo, LoyaltyPoints 
       FROM Attendee 
       WHERE ContactInfo = :contact 
       AND Password = :password`,
      {
        contact: contactInfo,
        password: password,
      }
    );

    await connection.close();

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const attendee = {
      id: result.rows[0][0],
      name: result.rows[0][1],
      contactInfo: result.rows[0][2],
      loyaltyPoints: result.rows[0][3],
    };

    res.json({
      message: "Login successful",
      attendee: attendee,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;

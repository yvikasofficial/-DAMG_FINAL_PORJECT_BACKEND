const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");

/**
 * Establishes a connection to the Oracle database
 * @async
 * @returns {Promise<Connection>} Oracle database connection object
 * @throws {Error} If connection fails
 */
async function connectToDB() {
  try {
    const connection = await oracledb.getConnection({
      user: "system",
      password: "admin123",
      connectString: "localhost:1521/xe",
    });
    return connection;
  } catch (err) {
    console.error("Error:", err);
    throw err;
  }
}

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
  try {
    const connection = await connectToDB();
    const { name, contactInfo, password } = req.body;

    // Generate a new AttendeeId
    const result = await connection.execute(
      `SELECT NVL(MAX(Attendeeld), 0) + 1 as newId FROM Attendee`
    );
    const attendeeId = result.rows[0][0];

    // Insert new attendee
    await connection.execute(
      `INSERT INTO Attendee (Attendeeld, Name, ContactInfo, Password, PurchaseHistory, LoyaltyPoints) 
       VALUES (:id, :name, :contact, :password, '', 0)`,
      {
        id: attendeeId,
        name: name,
        contact: contactInfo,
        password: password,
      },
      { autoCommit: true }
    );

    await connection.close();
    res.status(201).json({
      message: "Registration successful",
      attendeeId: attendeeId,
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
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

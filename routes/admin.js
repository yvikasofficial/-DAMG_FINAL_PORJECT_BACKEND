/**
 * @fileoverview Admin authentication routes
 * @requires express
 * @requires oracledb
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Admin login endpoint
 * @route POST /api/admin/login
 * @param {Object} req.body - Request body
 * @param {string} req.body.username - Admin username
 * @param {string} req.body.password - Admin password
 * @returns {Object} Response object
 * @returns {boolean} Response.success - Indicates if login was successful
 * @returns {number} Response.adminId - Admin's unique identifier
 * @returns {string} Response.username - Admin's username
 * @throws {Error} 400 - If username or password is missing
 * @throws {Error} 401 - If credentials are invalid
 * @throws {Error} 500 - If server error occurs
 */
router.post("/login", async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    // Get database connection
    connection = await connectToDB();

    // Query database for user
    const result = await connection.execute(
      `SELECT ADMIN_ID, USERNAME 
             FROM ADMIN_USERS 
             WHERE USERNAME = :username 
             AND PASSWORD = :password 
             AND IS_ACTIVE = 1`,
      {
        username: username,
        password: password,
      }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const admin = {
      ADMIN_ID: result.rows[0][0],
      USERNAME: result.rows[0][1],
    };

    // Update last login date
    await connection.execute(
      `UPDATE ADMIN_USERS 
             SET LAST_LOGIN_DATE = CURRENT_TIMESTAMP 
             WHERE ADMIN_ID = :adminId`,
      {
        adminId: admin.ADMIN_ID,
      },
      { autoCommit: true }
    );

    res.json({
      success: true,
      adminId: admin.ADMIN_ID,
      username: admin.USERNAME,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
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

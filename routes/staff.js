/**
 * @fileoverview Staff management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Get list of all staff members
 * @route GET /api/staff
 * @returns {Array<Object>} List of staff members
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    // Query to get all staff members
    const result = await connection.execute(
      "SELECT STAFF_ID, NAME, ROLE FROM STAFF"
    );

    const staffList = result.rows.map((row) => ({
      staffId: row[0],
      name: row[1],
      role: row[2],
    }));

    res.json(staffList);
  } catch (error) {
    console.error("Error retrieving staff list:", error);
    res.status(500).json({ message: "Failed to retrieve staff list" });
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
 * Create a new staff member
 * @route POST /api/staff
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Staff member name
 * @param {string} req.body.role - Staff member role
 * @returns {Object} Created staff member details
 * @throws {Error} 400 - If required fields are missing
 * @throws {Error} 500 - If creation fails
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const { name, role } = req.body;

    // Validate input
    if (!name || !role) {
      return res.status(400).json({ message: "Name and role are required" });
    }

    connection = await connectToDB();

    // Get new staff ID from sequence
    const seqResult = await connection.execute(
      "SELECT STAFF_SEQ.NEXTVAL FROM DUAL"
    );
    const staffId = seqResult.rows[0][0];

    // Insert new staff member
    const result = await connection.execute(
      `INSERT INTO STAFF (STAFF_ID, NAME, ROLE) 
             VALUES (:id, :name, :role)`,
      {
        id: staffId,
        name: name,
        role: role,
      },
      { autoCommit: true }
    );

    res.status(201).json({
      success: true,
      staffId: staffId,
      name: name,
      role: role,
    });
  } catch (error) {
    console.error("Staff creation error:", error);
    res.status(500).json({ message: "Failed to create staff member" });
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
 * Delete a staff member
 * @route DELETE /api/staff/:id
 * @param {number} req.params.id - Staff ID to delete
 * @returns {Object} Success message
 * @throws {Error} 404 - If staff member not found
 * @throws {Error} 500 - If deletion fails
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const staffId = req.params.id;

    connection = await connectToDB();

    // Check if staff exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM STAFF WHERE STAFF_ID = :id",
      [staffId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    // Delete staff member
    await connection.execute(
      "DELETE FROM STAFF WHERE STAFF_ID = :id",
      [staffId],
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: "Staff member deleted successfully",
    });
  } catch (error) {
    console.error("Staff deletion error:", error);
    res.status(500).json({ message: "Failed to delete staff member" });
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

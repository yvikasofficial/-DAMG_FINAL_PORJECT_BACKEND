/**
 * @fileoverview Staff management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");
const oracledb = require("oracledb");

/**
 * Get list of all staff members
 * @route GET /api/staff
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    // Using STAFF_PACKAGE.LIST_ALL_STAFF instead of direct SQL
    const result = await connection.execute(
      `DECLARE
        v_cursor STAFF_PACKAGE.STAFF_CURSOR;
       BEGIN
        STAFF_PACKAGE.LIST_ALL_STAFF(v_cursor);
        :cursor := v_cursor;
       END;`,
      {
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
      }
    );

    const resultSet = result.outBinds.cursor;
    const rows = await resultSet.getRows();
    await resultSet.close();

    const staffList = rows.map((row) => ({
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
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const { name, role } = req.body;

    if (!name || !role) {
      return res.status(400).json({ message: "Name and role are required" });
    }

    connection = await connectToDB();

    // Using STAFF_PACKAGE.ADD_STAFF instead of direct SQL
    await connection.execute(
      `BEGIN
        STAFF_PACKAGE.ADD_STAFF(:name, :role);
       END;`,
      {
        name: name,
        role: role,
      }
    );

    res.status(201).json({
      success: true,
      message: "Staff member added successfully",
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
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const staffId = req.params.id;
    connection = await connectToDB();

    // Using STAFF_PACKAGE.DELETE_STAFF instead of direct SQL
    const result = await connection.execute(
      `DECLARE
        v_status VARCHAR2(200);
       BEGIN
        STAFF_PACKAGE.DELETE_STAFF(:id, v_status);
        :status := v_status;
       END;`,
      {
        id: staffId,
        status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 200 },
      }
    );

    const status = result.outBinds.status || "";

    if (!status) {
      throw new Error("No status returned from delete operation");
    }

    if (status.includes("successfully")) {
      res.json({
        success: true,
        message: status,
      });
    } else if (status.includes("not found")) {
      res.status(404).json({ message: status });
    } else {
      res.status(500).json({ message: status });
    }
  } catch (error) {
    console.error("Staff deletion error:", error);
    res.status(500).json({
      message: "Failed to delete staff member",
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

module.exports = router;

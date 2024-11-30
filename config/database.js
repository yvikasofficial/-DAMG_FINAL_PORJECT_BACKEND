/**
 * @fileoverview Database configuration and connection
 * @requires oracledb
 */

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
      user: "system", // Replace with your Oracle username
      password: "admin123", // Replace with your Oracle password
      connectString: "localhost:1521/xe", // Replace with your Oracle connection string
    });
    return connection;
  } catch (err) {
    console.error("Error:", err);
    throw err;
  }
}

module.exports = {
  connectToDB,
};

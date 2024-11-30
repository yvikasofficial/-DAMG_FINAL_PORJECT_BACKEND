/**
 * @fileoverview Artist management routes with Staff integration
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Get all artists with manager details
 * @route GET /api/artists
 * @returns {Array<Object>} List of artists with manager info
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT 
                A.ARTIST_ID, 
                A.NAME, 
                A.GENRE, 
                A.CONTACT_INFO, 
                A.AVAILABILITY, 
                A.SOCIAL_MEDIA_LINK, 
                A.MANAGER_ID,
                S.NAME AS MANAGER_NAME,
                S.ROLE AS MANAGER_ROLE
             FROM ARTISTS A
             LEFT JOIN STAFF S ON A.MANAGER_ID = S.STAFF_ID 
             ORDER BY A.NAME`
    );

    const artists = result.rows.map((row) => ({
      artistId: row[0],
      name: row[1],
      genre: row[2],
      contactInfo: row[3],
      availability: row[4],
      socialMediaLink: row[5],
      manager: {
        managerId: row[6],
        name: row[7],
        role: row[8],
      },
    }));

    res.json(artists);
  } catch (error) {
    console.error("Error retrieving artists:", error);
    res.status(500).json({ message: "Failed to retrieve artists" });
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
 * Create a new artist
 * @route POST /api/artists
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Artist name
 * @param {string} req.body.genre - Artist genre
 * @param {string} req.body.contactInfo - Artist contact information
 * @param {string} req.body.availability - Artist availability
 * @param {string} req.body.socialMediaLink - Artist social media link
 * @param {number} req.body.managerId - Staff ID of the manager
 * @returns {Object} Created artist details
 * @throws {Error} 400 - If required fields are missing
 * @throws {Error} 404 - If manager not found
 * @throws {Error} 500 - If creation fails
 */
router.post("/", async (req, res) => {
  let connection;
  try {
    const {
      name,
      genre,
      contactInfo,
      availability,
      socialMediaLink,
      managerId,
    } = req.body;

    // Validate required fields
    if (!name || !genre || !contactInfo) {
      return res.status(400).json({
        message: "Name, genre, and contact information are required",
      });
    }

    connection = await connectToDB();

    // Verify manager exists if provided
    if (managerId) {
      const managerCheck = await connection.execute(
        "SELECT 1 FROM STAFF WHERE STAFF_ID = :id",
        [managerId]
      );
      if (managerCheck.rows.length === 0) {
        return res.status(404).json({ message: "Specified manager not found" });
      }
    }

    // Get new artist ID
    const seqResult = await connection.execute(
      "SELECT ARTIST_SEQ.NEXTVAL FROM DUAL"
    );
    const artistId = seqResult.rows[0][0];

    // Insert new artist
    await connection.execute(
      `INSERT INTO ARTISTS (
                ARTIST_ID, 
                NAME, 
                GENRE, 
                CONTACT_INFO, 
                AVAILABILITY, 
                SOCIAL_MEDIA_LINK, 
                MANAGER_ID
            ) VALUES (
                :id, 
                :name, 
                :genre, 
                :contactInfo, 
                :availability, 
                :socialMediaLink, 
                :managerId
            )`,
      {
        id: artistId,
        name: name,
        genre: genre,
        contactInfo: contactInfo,
        availability: availability || null,
        socialMediaLink: socialMediaLink || null,
        managerId: managerId || null,
      },
      { autoCommit: true }
    );

    // Fetch the created artist with manager details
    const result = await connection.execute(
      `SELECT 
                A.ARTIST_ID, 
                A.NAME, 
                A.GENRE, 
                A.CONTACT_INFO, 
                A.AVAILABILITY, 
                A.SOCIAL_MEDIA_LINK, 
                A.MANAGER_ID,
                S.NAME AS MANAGER_NAME,
                S.ROLE AS MANAGER_ROLE
             FROM ARTISTS A
             LEFT JOIN STAFF S ON A.MANAGER_ID = S.STAFF_ID 
             WHERE A.ARTIST_ID = :id`,
      [artistId]
    );

    const artist = {
      artistId: result.rows[0][0],
      name: result.rows[0][1],
      genre: result.rows[0][2],
      contactInfo: result.rows[0][3],
      availability: result.rows[0][4],
      socialMediaLink: result.rows[0][5],
      manager: {
        managerId: result.rows[0][6],
        name: result.rows[0][7],
        role: result.rows[0][8],
      },
    };

    res.status(201).json({
      success: true,
      ...artist,
    });
  } catch (error) {
    console.error("Artist creation error:", error);
    res.status(500).json({ message: "Failed to create artist" });
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
 * Delete an artist
 * @route DELETE /api/artists/:id
 * @param {number} req.params.id - Artist ID to delete
 * @returns {Object} Success message
 * @throws {Error} 404 - If artist not found
 * @throws {Error} 500 - If deletion fails
 */
router.delete("/:id", async (req, res) => {
  let connection;
  try {
    const artistId = req.params.id;

    connection = await connectToDB();

    // Check if artist exists
    const checkResult = await connection.execute(
      "SELECT 1 FROM ARTISTS WHERE ARTIST_ID = :id",
      [artistId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Artist not found" });
    }

    // Delete artist
    await connection.execute(
      "DELETE FROM ARTISTS WHERE ARTIST_ID = :id",
      [artistId],
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: "Artist deleted successfully",
    });
  } catch (error) {
    console.error("Artist deletion error:", error);
    res.status(500).json({ message: "Failed to delete artist" });
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

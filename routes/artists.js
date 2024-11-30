/**
 * @fileoverview Artist management routes
 * @requires express
 * @requires ../config/database
 */

const express = require("express");
const router = express.Router();
const { connectToDB } = require("../config/database");

/**
 * Get all artists
 * @route GET /api/artists
 * @returns {Array<Object>} List of artists
 * @throws {Error} 500 - If retrieval fails
 */
router.get("/", async (req, res) => {
  let connection;
  try {
    connection = await connectToDB();

    const result = await connection.execute(
      `SELECT 
                ARTIST_ID, 
                NAME, 
                GENRE, 
                CONTACT_INFO, 
                AVAILABILITY, 
                SOCIAL_MEDIA_LINK, 
                MANAGER_CONTACT 
             FROM ARTISTS 
             ORDER BY NAME`
    );

    const artists = result.rows.map((row) => ({
      artistId: row[0],
      name: row[1],
      genre: row[2],
      contactInfo: row[3],
      availability: row[4],
      socialMediaLink: row[5],
      managerContact: row[6],
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
 * @param {string} req.body.managerContact - Manager contact information
 * @returns {Object} Created artist details
 * @throws {Error} 400 - If required fields are missing
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
      managerContact,
    } = req.body;

    // Validate required fields
    if (!name || !genre || !contactInfo) {
      return res.status(400).json({
        message: "Name, genre, and contact information are required",
      });
    }

    connection = await connectToDB();

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
                MANAGER_CONTACT
            ) VALUES (
                :id, 
                :name, 
                :genre, 
                :contactInfo, 
                :availability, 
                :socialMediaLink, 
                :managerContact
            )`,
      {
        id: artistId,
        name: name,
        genre: genre,
        contactInfo: contactInfo,
        availability: availability || null,
        socialMediaLink: socialMediaLink || null,
        managerContact: managerContact || null,
      },
      { autoCommit: true }
    );

    res.status(201).json({
      success: true,
      artistId: artistId,
      name: name,
      genre: genre,
      contactInfo: contactInfo,
      availability: availability,
      socialMediaLink: socialMediaLink,
      managerContact: managerContact,
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

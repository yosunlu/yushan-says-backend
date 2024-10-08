import { db } from "./database.js";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();

// Middleware
app.use(cors()); // Enable CORS
app.use(bodyParser.json());

// Basic Route for Testing Connection
app.get("/", (req, res) => {
  res.status(200).send("Connected");
});

// GET API to Fetch All Records with Total Count
app.get("/api", async (req, res) => {
  res.set("Content-Type", "application/json");
  const sql = "SELECT * FROM Words";
  const countSql = "SELECT COUNT(*) FROM Words";
  let data = { phrases: [], totalCount: 0 };

  try {
    // Fetch the total count
    const countResult = await db.query(countSql);
    data.totalCount = parseInt(countResult.rows[0].count, 10);

    // Fetch the phrases
    const result = await db.query(sql);
    result.rows.forEach((row) => {
      data.phrases.push({
        id: row.id,
        phrase: row.phrase,
        pronounciation: row.pronounciation,
        mandarin: row.mandarin,
        definition: row.definition,
        usage: row.usage,
        tags: row.tags,
        audioURL: row.audiourl,
      });
    });

    // Send the response
    res.status(200).json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ code: 500, status: err.message });
  }
});

// GET API to Fetch All Records with page cursor
app.get("/api/:page", async (req, res) => {
  res.set("Content-Type", "application/json");

  const page = parseInt(req.params.page, 10); // Convert to integer
  const offset = (page - 1) * 10;

  const countSql = "SELECT COUNT(*) FROM Words";
  const sql = "SELECT * FROM Words WHERE id > $1 LIMIT 10";
  const values = [offset];
  let data = { phrases: [], totalCount: 0 };

  try {
    // Fetch the total count
    const countResult = await db.query(countSql);
    data.totalCount = parseInt(countResult.rows[0].count, 10);

    // Fetch the phrases
    const result = await db.query(sql, values);
    result.rows.forEach((row) => {
      data.phrases.push({
        id: row.id,
        phrase: row.phrase,
        pronounciation: row.pronounciation,
        mandarin: row.mandarin,
        definition: row.definition,
        usage: row.usage,
        tags: row.tags,
        audioURL: row.audiourl,
      });
    });

    // Send the response
    res.status(200).json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ code: 500, status: err.message });
  }
});

// GET API to Fetch All Records with tag and page cursor
app.get("/api/:tag/:page", async (req, res) => {
  res.set("Content-Type", "application/json");

  const page = parseInt(req.params.page, 10); // Convert to integer
  const tag = req.params.tag; // Extract the tag from the URL parameter
  const offset = (page - 1) * 10;

  // Update the SQL queries to filter by tag
  let countSql;
  let sql;
  if (tag == "Proverb" || tag == "EL") {
    sql = "SELECT * FROM Words WHERE usage = $1 ORDER BY id OFFSET $2 LIMIT 10";
    countSql = "SELECT COUNT(*) FROM Words WHERE usage = $1";
  } else {
    sql =
      "SELECT * FROM Words WHERE tags @> ARRAY[$1] ORDER BY id OFFSET $2 LIMIT 10";
    countSql = "SELECT COUNT(*) FROM Words WHERE tags @> ARRAY[$1]";
  }
  const countValues = [tag];
  const sqlValues = [tag, offset];

  let data = { phrases: [], totalCount: 0 };

  try {
    // Fetch the total count of phrases with the specified tag
    const countResult = await db.query(countSql, countValues);
    data.totalCount = parseInt(countResult.rows[0].count, 10);

    // Fetch the phrases with the specified tag, applying pagination
    const result = await db.query(sql, sqlValues);
    result.rows.forEach((row) => {
      data.phrases.push({
        id: row.id,
        phrase: row.phrase,
        pronounciation: row.pronounciation,
        mandarin: row.mandarin,
        definition: row.definition,
        usage: row.usage,
        tags: row.tags,
        audioURL: row.audiourl,
      });
    });

    // Send the response
    res.status(200).json(data);
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// get API to search for a keyword
app.get("/search/:keyword/:page", async (req, res) => {
  res.set("Content-Type", "application/json");

  const page = parseInt(req.params.page, 10); // Convert to integer
  const keyword = req.params.keyword.trim(); // Extract and trim the search keyword
  const offset = (page - 1) * 10;
  if (!keyword) {
    return res.status(400).json({ error: "Search keyword cannot be empty" });
  }

  const searchQuery = `%${keyword}%`; // Prepare the search pattern for SQL

  const sql = `
        SELECT * FROM Words 
        WHERE 
            phrase ILIKE $1 OR
            pronounciation ILIKE $1 OR
            mandarin ILIKE $1 OR
            definition ILIKE $1 OR
            usage ILIKE $1 OR
            ARRAY_TO_STRING(tags, ' ') ILIKE $1 OR
            audioURL ILIKE $1
        ORDER BY id
        OFFSET $2 
        LIMIT 10;
        `;

  const countSql = `
        SELECT COUNT(*) FROM Words 
        WHERE 
            phrase ILIKE $1 OR
            pronounciation ILIKE $1 OR
            mandarin ILIKE $1 OR
            definition ILIKE $1 OR
            usage ILIKE $1 OR
            ARRAY_TO_STRING(tags, ' ') ILIKE $1 OR
            audioURL ILIKE $1
        `;

  const countValues = [searchQuery];
  const sqlValues = [searchQuery, offset];

  let data = { phrases: [], totalCount: 0 };

  try {
    // Execute the count SQL query
    const countResult = await db.query(countSql, countValues);
    data.totalCount = parseInt(countResult.rows[0].count, 10);

    // Execute the search SQL query
    const result = await db.query(sql, sqlValues);
    result.rows.forEach((row) => {
      data.phrases.push({
        id: row.id,
        phrase: row.phrase,
        pronounciation: row.pronounciation,
        mandarin: row.mandarin,
        definition: row.definition,
        usage: row.usage,
        tags: row.tags,
        audioURL: row.audiourl,
      });
    });

    if (data.phrases.length === 0) {
      return res.status(404).json({ message: "No matching results found" });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Error executing search query", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// TODO
// POST API to Insert a New Record
app.post("/api", async (req, res) => {
  res.set("Content-Type", "application/json");
  const sql =
    "INSERT INTO Words(phrase, pronounciation, definition, tags, audioURL) VALUES($1, $2, $3, $4, $5) RETURNING id";

  try {
    const result = await db.query(sql, [
      req.body.phrase,
      req.body.pronounciation,
      req.body.definition,
      req.body.tags,
      req.body.audioURL,
    ]);
    const newID = result.rows[0].id;
    res
      .status(201)
      .json({ status: 201, message: `Record created with ID ${newID}` });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ code: 500, status: err.message });
  }
});

// TODO
// POST API for Batch Input
app.post("/api/batch", async (req, res) => {
  res.set("Content-Type", "application/json");

  const wordsArray = req.body;

  if (!Array.isArray(wordsArray) || wordsArray.length === 0) {
    return res.status(400).json({
      status: 400,
      message: "Invalid input, expected an array of words",
    });
  }

  const values = [];
  const placeholders = wordsArray
    .map(
      (_, i) =>
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${
          i * 5 + 5
        })`
    )
    .join(",");

  wordsArray.forEach((word) => {
    values.push(
      word.phrase,
      word.pronounciation,
      word.definition,
      word.tags,
      word.audioURL
    );
  });

  const sql = `INSERT INTO Words(phrase, pronounciation, definition, tags, audioURL) VALUES ${placeholders}`;

  try {
    const result = await db.query(sql, values);
    res.status(201).json({
      status: 201,
      message: `Batch insert successful, inserted ${result.rowCount} records.`,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: 500, message: err.message });
  }
});

// TODO
// DELETE API to Remove a Record by ID

app.delete("/api/:id", async (req, res) => {
  const sql = "DELETE FROM Words WHERE id = $1";

  try {
    const result = await db.query(sql, [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ status: 404, message: "Record not found" });
    } else {
      res.status(200).json({
        status: 200,
        message: `Record with ID ${req.params.id} deleted`,
      });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ code: 500, status: err.message });
  }
});

// Start the Server
app.listen(4000, (err) => {
  if (err) {
    console.error("Error:", err.message);
  } else {
    console.log("Listening on port 4000");
  }
});

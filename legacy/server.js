const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // Bawaan XAMPP kosong
  database: "chord_db",
});

db.connect((err) => {
  if (err) {
    console.error("Gagal koneksi ke XAMPP MySQL:", err);
    return;
  }
  console.log("Mantap! Berhasil terkoneksi ke MySQL XAMPP.");
});

// ROUTE 1: Ambil semua lagu polos tanpa filter WHERE (Biar gak memicu eror 500)
app.get("/api/songs", (req, res) => {
  const query = "SELECT id, title, artist FROM songs";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ROUTE 2: Ambil detail satu lagu berdasarkan ID
app.get("/api/songs/:id", (req, res) => {
  const songId = req.params.id;
  const query = "SELECT * FROM songs WHERE id = ?";

  db.query(query, [songId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(404).json({ message: "Lagu gak ketemu di database" });
    }
    res.json(results[0]);
  });
});

app.listen(3000, () => {
  console.log("Server backend lu udah jalan di http://localhost:3000");
});

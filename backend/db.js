// db.js
const { MongoClient } = require('mongodb');

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

let db;

async function connectToDB() {
    try {
        await client.connect();
        db = client.db('seefoodDB'); // Your DB name here
        console.log("✅ Connected to MongoDB");
    } catch (err) {
        console.error("❌ DB connection error:", err);
    }
}

function getDB() {
    return db;
}

module.exports = { connectToDB, getDB };

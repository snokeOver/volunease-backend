import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

import { MongoClient, ObjectId } from "mongodb";

// Initialize the express app
const app = express();
dotenv.config();

const serverPort = process.env.SERVER_PORT || 5000;
const mongoUrl = process.env.MONGO_URL;
const allowedUrls = process.env.ALLOWED_URLS.split(",");

// Middlewares
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedUrls.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

//Create a MongoClient instances

const client = new MongoClient(mongoUrl);

async function run() {
  try {
    const result = await client.connect();
    if (result.topology.client.topology.s.state === "connected") {
      console.log("MongoDB connection successful!");
    }

    //  end of all APIs
  } catch (err) {
    console.log(err.message);
  }
}

run().catch(console.error);

app.get("/", (req, res) => {
  res.send("Hello from VolunEase");
});

app.listen(serverPort, () => {
  console.log(`VolunEase is running on ${serverPort}`);
});

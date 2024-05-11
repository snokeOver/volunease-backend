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

// Middlewares to verify token
const verifyToken = async (req, res, next) => {
  const receivedToken = req.cookies.token;
  if (!receivedToken) {
    console.log("No token");
    return res.status(401).send({ message: "Unauthorised" });
  }
  jwt.verify(receivedToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log(err.message);
      return res.status(401).send({ message: "Unauthorised" });
    }
    req.user = decoded;

    next();
  });
};

//Create a MongoClient instances

const client = new MongoClient(mongoUrl);

async function run() {
  try {
    // Services collection
    const postCollection = client.db("Volun-Ease").collection("posts");

    // Services collection
    const checkOutCollection = client.db("Volun-Ease").collection("checkOuts");

    // Auth Related APIS

    // JWT Create API
    app.post("/api/jwt", async (req, res) => {
      try {
        const token = jwt.sign(req.body, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" ? true : false,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        console.error(err.message);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Log Out API
    app.post("/api/logout", (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Services Relative API

    // add Volunteer Post to db
    app.post("/api/add-post", verifyToken, async (req, res) => {
      if (req.body.uid !== req.user.uid) {
        return res.status(403).send({ message: "Forbidden" });
      }
      try {
        const result = await postCollection.insertOne(req.body);
        console.log(result);
        res.status(201).send({ message: "Volunteer Post added successfully" });
      } catch (error) {
        console.error("Error adding Volunteer Post:", error);
        res.status(500).send({ message: "Failed to add Tourist spot" });
      }
    });

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

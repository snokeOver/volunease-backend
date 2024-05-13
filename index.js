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
    // User preference collection
    const userPreferenceCollection = client
      .db("Volun-Ease")
      .collection("userPreferences");

    // User preference collection
    const volunRequestCollection = client
      .db("Volun-Ease")
      .collection("volunRequests");

    // Banner Images collection
    const bannerImageCollection = client
      .db("Volun-Ease")
      .collection("bannerImages");

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

    // Add user preference to db
    app.post("/api/user-preference", async (req, res) => {
      try {
        const existingPreference = await userPreferenceCollection.findOne({
          uid: req.body.uid,
        });
        if (existingPreference) {
          const query = { uid: req.body.uid };
          const updateData = req.body;
          const updatedResult = await userPreferenceCollection.updateOne(
            query,
            {
              $set: updateData,
            }
          );
          res.status(200).send(updatedResult);
        } else {
          const insertResult = await userPreferenceCollection.insertOne(
            req.body
          );
          res.send({ message: "Insert Success" });
        }
      } catch (error) {
        console.error("Error adding user preference:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get user preference from db based on the uid
    app.get("/api/user-preference/:id", async (req, res) => {
      try {
        const result = await userPreferenceCollection.findOne({
          uid: req.params.id,
        });
        if (result) {
          res.send(result);
        } else {
          const insertResult = await userPreferenceCollection.insertOne({
            uid: req.params.id,
            theme: "dark",
          });
          res.send(insertResult);
        }
      } catch (error) {
        console.error("Error fetching User preference :", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get Organizer posts from db based on the uid
    app.get("/api/organizer-posts/:id", async (req, res) => {
      try {
        const result = await postCollection
          .find({ uid: req.params.id })
          .toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching organizer's posts:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get Volunteer's requests from db based on the uid
    app.get("/api/volunteer-requests/:id", async (req, res) => {
      try {
        const result = await volunRequestCollection
          .find({
            volunteerId: req.params.id,
          })
          .toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching volunteer's requests:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

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

    // check if the post is already requested
    app.post("/api/request-check", verifyToken, async (req, res) => {
      const query = {
        postId: req.body.postId,
        volunteerId: req.body.volunteerId,
      };

      try {
        const result = await volunRequestCollection.findOne(query);
        if (!result) {
          res.status(201).send({ success: false });
        } else {
          res.status(201).send({ success: true });
        }
      } catch (error) {
        console.error("Error to find Post:", error);
        res.status(500).send({ message: "Failed to Find post" });
      }
    });

    //Create Request to be a Volunteer for a particular post
    app.post("/api/request-to-volunteer", verifyToken, async (req, res) => {
      if (req.body.volunteerId !== req.user.uid) {
        return res.status(403).send({ message: "Forbidden" });
      }
      try {
        const result = await volunRequestCollection.insertOne(req.body);
        // update the Vounteer required number
        const response = await postCollection.updateOne(
          { _id: new ObjectId(req.body.postId) },
          {
            $inc: { volunNumber: -1 },
          }
        );
        res.status(201).send({ message: "Request added successfully" });
      } catch (error) {
        console.error("Error creating Request:", error);
        res.status(500).send({ message: "Failed to save request" });
      }
    });

    // Delete Single Organizer post from db filtered by id
    app.delete("/api/post/:id", verifyToken, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      try {
        const result = await postCollection.deleteOne(query);
        const response = await volunRequestCollection.deleteMany({
          postId: req.params.id,
        });
        res.status(200).send(result);
      } catch (error) {
        console.error("Error deleting this Organizer post:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Delete/Cancel Single volunteer request from db filtered by id
    app.delete("/api/delete-request/:id", verifyToken, async (req, res) => {
      const query = {
        postId: req.params.id,
      };
      try {
        const result = await volunRequestCollection.deleteOne(query);

        // update the Vounteer required number
        const response = await postCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          {
            $inc: { volunNumber: 1 },
          }
        );
        res.status(201).send({ message: "Request deleted successfully" });
      } catch (error) {
        console.error("Error deleting this volunteer request:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Update Single post of organizer from db filtered by id
    app.patch("/api/post/:id", verifyToken, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const updateData = req.body;
      try {
        const result = await postCollection.updateOne(query, {
          $set: updateData,
        });
        res.status(200).send(result);
      } catch (error) {
        console.error("Error updating this Post:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get all banner images from db for banner, login and join page
    app.get("/api/banner-images", async (req, res) => {
      try {
        const result = await bannerImageCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching Banner Images:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get all Volunteers Post from db for Home Volunteers-need-now section in home page
    app.get("/api/posts", async (req, res) => {
      try {
        const result = await postCollection
          .find()
          .sort({ _id: -1 })
          .limit(6)
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching posts for volunteers:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get all Volunteers Post from db based on pagination
    app.get("/api/pagination-posts", async (req, res) => {
      try {
        const curPage = parseInt(req.query.page);
        const size = parseInt(req.query.size);
        const result = await postCollection
          .find()
          .skip((curPage - 1) * size)
          .limit(size)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching posts for volunteers:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get total volunteers post number from db
    app.get("/api/post-number", async (req, res) => {
      try {
        const response = await postCollection.estimatedDocumentCount();
        res.send({ response });
      } catch (error) {
        console.error("Error fetching total post number:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get Single Volunteers Post from db based on post id
    app.get("/api/post/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      try {
        const result = await postCollection.findOne(query);
        if (result) {
          res.send(result);
        } else {
          res.status(404).send({ message: "Volunteer Post not found" });
        }
      } catch (error) {
        console.error("Error fetching Volunteer Post:", error);
        res.status(500).send({ message: "Internal server error" });
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

import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import admin, { cert } from "firebase-admin";
import { getAuth } from "firebase-admin/auth";

const app = express();
const port = process.env.PORT || 10000;

// ---------- Firebase Admin Init ----------
if (!process.env.FIREBASE_SERVICE_KEY) {
  throw new Error("FIREBASE_SERVICE_KEY is missing in environment variables");
}
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf-8")
);

admin.initializeApp({
  credential: cert(serviceAccount),
});

app.use(cors());
app.use(json());

// ---------- MongoDB Setup ----------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pnssve1.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  }
}

// প্রতিটা request-এর আগে কানেকশন গ্যারান্টি করা হচ্ছে (cold start-safe)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).send({ message: "Database connection failed" });
  }
});

const db = client.db("smart_db");
const productsCollection = db.collection("products");
const bidsCollection = db.collection("bids");
const usersCollection = db.collection("users");

// ---------- Middlewares ----------
const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const userInfo = await getAuth().verifyIdToken(token);
    req.user = userInfo;
    next();
  } catch (err) {
    console.error("Firebase token verify error:", err);
    return res.status(401).send({ message: "unauthorized access" });
  }
};

// ---------- Root ----------
app.get("/", (req, res) => {
  res.send("Your server is ok");
});

// ---------- Users APIs ----------
app.post("/users", async (req, res) => {
  try {
    const newUser = req.body;
    const result = await usersCollection.insertOne(newUser);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to create user" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch users" });
  }
});

app.get("/users/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const result = await usersCollection.findOne({ uid });
    if (!result) return res.status(404).send({ message: "User not found" });
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch user" });
  }
});

app.patch("/users/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const updatedUser = { $set: req.body };
    const result = await usersCollection.updateOne({ uid }, updatedUser);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to update user" });
  }
});

app.delete("/users/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const result = await usersCollection.deleteOne({ uid });
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to delete user" });
  }
});

// ---------- Products APIs ----------
app.get("/products", async (req, res) => {
  try {
    const email = req.query.email;
    const query = {};
    if (email) query.email = email;
    const products = await productsCollection.find(query).toArray();
    res.send(products);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch products" });
  }
});

app.get("/latest-products", async (req, res) => {
  try {
    const result = await productsCollection
      .find()
      .sort({ price_min: 1 })
      .limit(6)
      .toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch latest products" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid product id" });
    }
    const query = { _id: new ObjectId(id) };
    const result = await productsCollection.findOne(query);
    if (!result) return res.status(404).send({ message: "Product not found" });
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch product" });
  }
});

app.get("/products/bids/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    const query = { product: productId };
    const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
    const result = await cursor.toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch bids for product" });
  }
});

app.post("/products", verifyFirebaseToken, async (req, res) => {
  try {
    const newProduct = {
      ...req.body,
      email: req.user.email,
      uid: req.user.uid,
      created_at: new Date(),
      status: "pending",
    };
    const result = await productsCollection.insertOne(newProduct);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to create product" });
  }
});

app.patch("/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid product id" });
    }
    const query = { _id: new ObjectId(id) };
    const update = { $set: req.body };
    const result = await productsCollection.updateOne(query, update);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to update product" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid product id" });
    }
    const query = { _id: new ObjectId(id) };
    const result = await productsCollection.deleteOne(query);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to delete product" });
  }
});

// ---------- Bids APIs ----------
app.post("/bids", async (req, res) => {
  try {
    const newBid = req.body;
    const result = await bidsCollection.insertOne(newBid);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to create bid" });
  }
});

app.get("/bids", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.query.email;
    const query = {};
    if (email) {
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      query.buyer_email = email;
    }
    const cursor = bidsCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch bids" });
  }
});

app.get("/bids/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid bid id" });
    }
    const query = { _id: new ObjectId(id) };
    const result = await bidsCollection.findOne(query);
    if (!result) return res.status(404).send({ message: "Bid not found" });
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch bid" });
  }
});

app.patch("/bids/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid bid id" });
    }
    const query = { _id: new ObjectId(id) };
    const updatedBid = { $set: req.body };
    const result = await bidsCollection.updateOne(query, updatedBid);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to update bid" });
  }
});

app.delete("/bids/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid bid id" });
    }
    const query = { _id: new ObjectId(id) };
    const result = await bidsCollection.deleteOne(query);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to delete bid" });
  }
});

// ---------- Server Listen (লোকাল আর Vercel দুই জায়গাতেই চলবে) ----------
app.listen(port, () => {
  console.log(`server is running on port : ${port}`);
});

// Vercel-এর জন্য অবশ্যই লাগবে — এটা ছাড়া Vercel জানবে না কোন handler চালাতে হবে
export default app;
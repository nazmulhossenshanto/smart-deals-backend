import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

import express, { json } from "express";
import cors from "cors";
const app = express();
import dotenv from "dotenv";
dotenv.config();
import admin, { cert } from "firebase-admin";
import { getAuth } from "firebase-admin/auth";

const port = process.env.PORT || 3000;

const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf-8"))

admin.initializeApp({
  credential: cert(serviceAccount),
});
app.use(cors());
app.use(json());

const logger = (req, res, next) => {
  console.log("logging information");
  next();
};

// connect to mongo db
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pnssve1.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Your server is ok");
});

const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  // verify token
  try {
    const userInfo = await getAuth().verifyIdToken(token);
    req.user = userInfo;
    next();
  } catch {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

async function run() {
  try {
    await client.connect();
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
    // create product database into mongo db
    const db = client.db("smart_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");
    const usersCollection = db.collection("users");

    // create user into db
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });
    // get all users from db
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // get single user from db
    app.get("/users/:uid", async (req, res) => {
      const uid = req.params.uid;
      const result = await usersCollection.findOne({ uid });
      res.send(result);
    });
    // update an user into db
    app.patch("/users/:uid", async (req, res) => {
      const uid = req.params.uid;
      const updatedUser = {
        $set: req.body,
      };
      const result = await usersCollection.updateOne({ uid }, updatedUser);
      res.send(result);
    });
    // delete user from db
    app.delete("/users/:uid", async (req, res) => {
      const uid = req.params.uid;
      const result = await usersCollection.deleteOne({ uid });
      res.send(result);
    });

    // get all  products from db
    app.get("/products", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });

    // get latest products
    app.get("/latest-products", async (req, res) => {
      const result = await productsCollection
        .find()
        .sort({ price_min: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    // get single products from db
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // get all bid for a single product
    app.get("/products/bids/:productId", async (req, res) => {
      const productId = req.params.productId;
      const query = { product: productId };
      const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // create product into db
    app.post("/products", verifyFirebaseToken, async (req, res) => {
      const newProduct = {
        ...req.body,
        email: req.user.email,
        uid: req.user.uid,
        created_at: new Date(),
        status: "pending",
      };
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // update a product from db
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: req.body,
      };
      const result = await productsCollection.updateOne(query, update);
      res.send(result);
    });

    // delete product from db
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // bids related apis

    // create a bid
    app.post("/bids", async (req, res) => {
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });
    // get all bids

    app.get("/bids", verifyFirebaseToken, async (req, res) => {
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
    });

    // get a single bids
    app.get("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: id,
      };
      const result = await bidsCollection.findOne(query);

      res.send(result);
    });

    // update a bid
    app.patch("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const updatedBid = {
        $set: req.body,
      };
      const result = await bidsCollection.updateOne(query, updatedBid);
      res.send(result);
    });
    // delete a bid
    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });

    // app.listen(port, () => {
    //   console.log(`server is running on port : ${port}`);
    // });
  } finally {
  }
}
run().catch(console.dir);

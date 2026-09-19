const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// connect to mongo db
const uri =
  "mongodb+srv://smart_deals_users_db:HlUGPxm6csupqNX6@cluster0.pnssve1.mongodb.net/?appName=Cluster0";
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

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
    // create product database into mongo db
    const db = client.db("smart_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids"); 
    const usersCollection = db.collection('users');

    // create user into db
    app.post('/users', async(req, res)=>{
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser);
      res.send(result)

    });
    // get all users from db
    app.get('/users', async(req, res)=>{
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // get single user from db
    app.get('/users/:uid', async(req, res)=>{
      const uid = req.params.uid;
      const result = await usersCollection.findOne({uid});
      res.send(result)
    });
    // update an user into db
    app.patch('/users/:uid', async(req, res)=>{
      const uid = req.params.uid;
      const updatedUser = {
        $set: req.body
      };
      const result = await usersCollection.updateOne(uid, updatedUser);
      res.send(result)
    });

    // get all  products from db
    app.get("/products", async (req, res) => {
      const products = await productsCollection.find().toArray();
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

    // create product into db
    app.post("/products", async (req, res) => {
      const newUser = req.body;
      const result = await productsCollection.insertOne(newUser);
      console.log("product from server", result);
      res.send(result);
    });

    // update a product from db
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedProduct = req.body;
      const update = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
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

    app.get("/bids", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
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
    app.patch('/bids/:id', async (req, res)=>{
      const id = req.params.id;
      const query = {_id: id};
      const updatedBid = {
        $set: req.body
      };
      const result = await bidsCollection.updateOne(query, updatedBid)
      res.send(result)
    })
    // delete a bid 
    app.delete('/bids/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: id};
      const result = await bidsCollection.deleteOne(query);
      res.send(result)
    })




  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port : ${port}`);
});

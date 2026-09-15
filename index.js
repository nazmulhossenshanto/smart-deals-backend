const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
app.use(cors())
app.use(express.json());


// connect to mongo db
const uri = "mongodb+srv://smart_deals_users_db:HlUGPxm6csupqNX6@cluster0.pnssve1.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
}); 


app.get('/', (req, res )=>{
    res.send('Your server is ok')
});

async function run (){
  try{
    await client.connect();
     await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
      // create product database into mongo db
      const db = client.db('smart_db');
      const productsCollection = db.collection('products');

    // get products from db
    app.get('/products', async(req, res)=>{
      const products = await productsCollection.find().toArray();
      res.send(products);
    })


      // create product into db
      app.post('/products', async(req, res)=>{
        const newUser = req.body;
        const result = await productsCollection.insertOne(newUser);
        console.log( 'product from server', result);
        res.send(result)
      });
      // delete product from db
      app.delete('/products/:id', async(req, res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await productsCollection.deleteOne(query);
        res.send(result)
      })
      

  }
  finally{

  }
}
run().catch(console.dir)

app.listen(port, ()=>{
    console.log(`server is running on port : ${port}`);
})
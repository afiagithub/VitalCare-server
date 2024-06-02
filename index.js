const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: ["http://localhost:5173"],
    credentials: true
}))
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ctn12zm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const userCollection = client.db('diagnosDB').collection('users')
        const testsCollection = client.db('diagnosDB').collection('tests')

        // user APIs
        app.post("/users", async (req, res) => {
            const user = req.body;
            const query1 = { email: user.email }
            const isExist = await userCollection.findOne(query1);
            if (isExist) {
                return res.send({ message: 'User Already Exists' })
            }
            const query2 = { user_id: user.user_id }
            const userExist = await userCollection.findOne(query2);
            if (userExist) {
                return res.send({ message: 'User Already Exists' })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.get("/users/:uid", async (req, res) => {
            const user_id = req.params.uid;
            const query = { user_id: user_id };
            const result = await userCollection.findOne(query);
            res.send(result)
        })

        app.put("/users/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedUser = req.body;
            const updatedDoc = {
                $set: {
                    name: updatedUser.name,
                    email: updatedUser.email,
                    user_id: updatedUser.user_id,
                    photo: updatedUser.photo,
                    bloodType: updatedUser.bloodType,
                    dist: updatedUser.dist,
                    upazila: updatedUser.upazila,
                    status: updatedUser.status
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result)
        })

        // all tests APIs
        app.get("/tests", async(req, res) => {
            const result = await testsCollection.find().toArray()
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Diagnostic Server Running')
})

app.listen(port, () => {
    console.log(`Diagnostic Server Running on port ${port}`)
})

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors({
    origin: ["http://localhost:5173", "https://diagnostic-app-auth.web.app", "https://diagnostic-app-auth.firebaseapp.com"],
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
        const districtsCollection = client.db('diagnosDB').collection('districts')
        const upazilasCollection = client.db('diagnosDB').collection('upazilas')
        const reserveCollection = client.db('diagnosDB').collection('reservations')
        const reportCollection = client.db('diagnosDB').collection('reports')
        const bannerCollection = client.db('diagnosDB').collection('banners')
        const recomCollection = client.db('diagnosDB').collection('recommendation')
        const doctorCollection = client.db('diagnosDB').collection('doctors')
        const blogCollection = client.db('diagnosDB').collection('blogs')

        // jwt token API
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            // console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        const verifyToken = async (req, res, next) => {
            const auth = req.headers.authorization;
            if (!auth) {
                return res.status(401).send({ message: 'not authorized' })
            }

            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: 'not authorized' })
                }
                // console.log('value token: ', decoded);
                req.decoded = decoded;
                next();
            })
        };

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            // console.log(email);
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" })
            }
            next();
        }

        // user APIs
        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })

        app.get("/users/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            // console.log(user);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
                // console.log(admin);
            }
            res.send({ admin })
        })

        app.get("/userlist/blocked/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let blocked = false;
            if (user) {
                blocked = user?.status === 'blocked'
            }
            res.send({ blocked })
        })

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

        app.get("/users/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result)
        })

        app.get("/allUsers/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
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

        app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        app.patch("/block-user/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'blocked'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        // all tests APIs
        app.get("/tests", async (req, res) => {
            const date = req.query.date;
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            let query = {}
            if (date) {
                query = { date: { $gte: date } };
            }
            const result = await testsCollection.find(query)
                .skip(page * size)
                .limit(size)
                .toArray()
            res.send(result)
        })

        app.post("/tests", verifyToken, verifyAdmin, async (req, res) => {
            const newTest = req.body;
            const result = await testsCollection.insertOne(newTest);
            res.send(result)
        })

        app.get("/tests/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await testsCollection.findOne(query)
            res.send(result)
        })

        app.get("/filter-tests", async (req, res) => {
            const date = req.query.date;
            const query = { date: date };
            const result = await testsCollection.find(query).toArray()
            res.send(result)
        })

        app.patch("/tests/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedTest = req.body;
            const updatedDoc = {
                $set: {
                    image: updatedTest.image,
                    date: updatedTest.date,
                    slots: updatedTest.slots,
                    cost: updatedTest.cost,
                    title: updatedTest.title,
                    short_description: updatedTest.short_description,
                }
            }
            const result = await testsCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        app.patch("/booked-test/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedTest = req.body;
            const updatedDoc = {
                $set: {
                    slots: updatedTest.slots,
                }
            }
            const result = await testsCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        app.delete("/tests/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await testsCollection.deleteOne(query);
            res.send(result)
        })

        app.get("/test-count", async (req, res) => {
            const count = await testsCollection.estimatedDocumentCount()
            res.send({ count })
        })

        app.get("/districts", async (req, res) => {
            const result = await districtsCollection.find().toArray()
            res.send(result)
        })

        app.get("/upazilas", async (req, res) => {
            const result = await upazilasCollection.find().toArray()
            res.send(result)
        })

        // payment
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: [
                    'card'
                ]
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        // reservation APIs
        app.get("/reserve/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = {
                email: email,
                report: 'pending'
            };
            const result = await reserveCollection.find(query).toArray()
            res.send(result)

        })

        app.get("/download-reserve/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await reserveCollection.find(query).toArray()
            res.send(result)

        })

        app.get("/search-reserve", async (req, res) => {
            const email = req.query.email;
            const test_id = req.query.test_id;
            const query = {
                email: email,
                test_id: test_id
            }
            const result = await reserveCollection.find(query).toArray()
            res.send(result)

        })

        app.get("/all-reserve/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { test_id: id };
            const result = await reserveCollection.find(query).toArray()
            res.send(result)

        })

        app.get("/reserve-report/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await reserveCollection.findOne(query)
            res.send(result)

        })


        app.post('/reserve', async (req, res) => {
            const reservation = req.body;
            const result = await reserveCollection.insertOne(reservation);
            res.send(result)
        })

        app.patch("/cancel-reserve/:test_id", verifyToken, async (req, res) => {
            const test_id = req.params.test_id;
            const query = { _id: new ObjectId(test_id) };
            const result1 = await testsCollection.findOne(query);
            const newSlot = parseInt(result1.slots) + 1;
            const updatedSlots = newSlot.toString();
            const updatedDoc = {
                $set: {
                    slots: updatedSlots
                }
            }
            const result2 = await testsCollection.updateOne(query, updatedDoc);
            res.send({ result1, result2 })
        })

        app.delete("/reserve/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await reserveCollection.deleteOne(query);
            res.send(result)
        })

        // submit test report APIs
        app.get("/report/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { patient_email: email };
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            const result = await reportCollection.find(query).toArray()
            res.send(result)

        })

        app.post("/report", async (req, res) => {
            const newReport = req.body;
            const result = await reportCollection.insertOne(newReport);
            res.send(result)
        })

        app.patch("/deliver-test/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    report: 'delivered'
                }
            }
            const result = await reserveCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        // banner APIs
        app.get("/banners", verifyToken, verifyAdmin, async (req, res) => {
            const result = await bannerCollection.find().toArray();
            res.send(result)
        })

        app.post("/banners", verifyToken, verifyAdmin, async (req, res) => {
            const newBanner = req.body;
            const result = await bannerCollection.insertOne(newBanner);
            res.send(result)
        })

        app.get("/banner", async (req, res) => {
            const query = { isActive: true }
            const result = await bannerCollection.findOne(query);
            res.send(result)
        })

        app.get("/banners/:code", verifyToken, async (req, res) => {
            const coupon = req.params.code;
            const query = { coupon_code_name: coupon, isActive: true };
            const result = await bannerCollection.findOne(query);
            // console.log(result);
            res.send(result)
        })

        app.patch("/banners/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter1 = {};
            const filter2 = { _id: new ObjectId(id) };
            const deactivateBanner = {
                $set: {
                    isActive: false
                }
            }

            const activeBanner = {
                $set: {
                    isActive: true
                }
            }
            const result1 = await bannerCollection.updateMany(filter1, deactivateBanner)
            const result2 = await bannerCollection.updateOne(filter2, activeBanner)
            res.send({ result1, result2 })
        })

        app.delete("/banners/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bannerCollection.deleteOne(query);
            res.send(result)
        })

        // recommendation API
        app.get("/recommend", async (req, res) => {
            const result = await recomCollection.find().toArray();
            res.send(result)
        })

        // doctor list API
        app.get("/doctors", async (req, res) => {
            const result = await doctorCollection.find().toArray();
            res.send(result)
        })

        // statistics APIs
        app.get("/totbooking", verifyToken, verifyAdmin, async (req, res) => {
            const bookings = await reserveCollection.aggregate([
                {
                    $group: {
                        _id: "$test_id",
                        totalBookings: { $sum: 1 },
                        testTitle: { $first: "$title" }
                    }
                },
                {
                    $sort: { totalBookings: -1 }
                }
            ]).toArray()
            res.send(bookings);
        })

        app.get("/delivery-ratio", verifyToken, verifyAdmin, async (req, res) => {
            const query1 = { report: 'pending' }
            const query2 = { report: 'delivered' }
            const pendingCount = await reserveCollection.countDocuments(query1);
            const deliveryCount = await reserveCollection.countDocuments(query2);
            res.send([
                { status: 'pending', count: pendingCount },
                { status: 'delivered', count: deliveryCount }
            ]);
        })

        app.get("/top-tests", async (req, res) => {
            const bookings = await reserveCollection.aggregate([
                {
                    $addFields: { testId: { $toObjectId: "$test_id" } }
                },
                {
                    $lookup: {
                        from: "tests",
                        localField: "testId",
                        foreignField: "_id",
                        as: "testDetails"
                    }
                },
                {
                    $unwind: "$testDetails"
                },
                {
                    $group: {
                        _id: "$test_id",
                        totalBookings: { $sum: 1 },
                        testTitle: { $first: "$title" },
                        date: { $first: "$date" },
                        cost: { $first: "$price" },
                        image: { $first: "$testDetails.image" }
                    }
                },
                { $sort: { totalBookings: -1 } },
                { $limit: 6 },
                {
                    $project: {
                        _id: 1,
                        totalBookings: 1,
                        title: "$testTitle",
                        date: 1,
                        cost: 1,
                        image: 1
                    }
                }
            ]).toArray()
            res.send(bookings);
        })

        app.get('/blogs', async (req, res) => {
            const result = await blogCollection.find().toArray();
            res.send(result)
        })

        app.get('/blogs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await blogCollection.findOne(query);
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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

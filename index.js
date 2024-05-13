const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// all config
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// all middleware
const corsConfig = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://glamspot-khaled.web.app',
    'https://ph-a11-client-by-khaled.vercel.app',
    'https://ph-a11-client-by-khaled.surge.sh',
    'https://ph-a11-client-by-khaled.netlify.app',
  ],
  credentials: true,
};
app.use(cors(corsConfig));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2brfitt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// my made middlewares

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    if (req?.query?.email !== decoded?.email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    next();
  });
};

const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  secure: process.env.NODE_ENV === 'production',
};

async function run() {
  try {
    const serviceCollection = client.db('glamSpotDB').collection('services');
    const bookingCollection = client.db('glamSpotDB').collection('bookings');

    // auth related API
    // require('crypto').randomBytes(64).toString('hex')
    // gives token when user login
    app.post('/getJwtToken', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '4h',
      });
      res.cookie('token', token, cookieOptions).send({ success: true });
    });

    // deletes token when user logout
    app.post('/deleteJwtToken', async (req, res) => {
      res
        .clearCookie('token', { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    // services related API
    // post a service
    app.post('/add-service', verifyToken, async (req, res) => {
      const newService = req.body;
      const result = await serviceCollection.insertOne(newService);
      res.send(result);
    });

    // Get all services
    app.get('/all-services', async (req, res) => {
      const result = await serviceCollection.find().toArray();
      res.send(result);
    });

    // Get service details
    app.get('/service-details/:id', async (req, res) => {
      const Id = req.params.id;
      const query = { _id: new ObjectId(Id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    // get my service
    app.get('/my-services', verifyToken, async (req, res) => {
      const result = await serviceCollection
        .find({ providerEmail: req?.query?.email })
        .toArray();
      res.send(result);
    });

    //update a service
    app.patch('/update-service/:id', verifyToken, async (req, res) => {
      const ID = req.params.id;
      const query = { _id: new ObjectId(ID) };
      const result = await serviceCollection.updateOne(query, {
        $set: req.body,
      });
      res.send(result);
    });

    // delete a service
    app.delete('/delete-service/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    // Get services by pagination
    app.get('/all-services-by-pagination', async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const sort = req.query.sort;
      let options = {};
      if (sort) options = { sort: { serviceName: sort === 'asc' ? 1 : -1 } };
      const result = await serviceCollection
        .find({}, options)
        .skip(page * size)
        .limit(size)
        .toArray();

      res.send(result);
    });

    // Get services count
    app.get('/services-count', async (req, res) => {
      const count = await serviceCollection.countDocuments();
      res.send({ count });
    });

    // Get search results
    app.get('/search-services', async (req, res) => {
      const search = req.query.search;
      const query = {
        serviceName: { $regex: search, $options: 'i' },
      };
      const result = await serviceCollection.find(query).toArray();

      res.send(result);
    });

    // post a booking
    app.post('/book-now', verifyToken, async (req, res) => {
      const newBooking = req.body;
      const result = await bookingCollection.insertOne(newBooking);

      // increase booking count 1 in service collection
      const updateDoc = { $inc: { totalBookings: 1 } };
      const serviceQuery = { _id: new ObjectId(newBooking.serviceId) };
      const updateBidCount = await serviceCollection.updateOne(
        serviceQuery,
        updateDoc
      );

      res.send(result);
    });

    // get my bookings
    app.get('/bookings', verifyToken, async (req, res) => {
      const query = {
        customerEmail: req?.query?.email,
      };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // Get booking details
    app.get('/booking-details/:id', verifyToken, async (req, res) => {
      const BookingID = req.params.id;
      const query = { _id: new ObjectId(BookingID) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    // update my booking
    app.patch('/update-booking/:id', verifyToken, async (req, res) => {
      const BookingID = req.params.id;
      const filter = { _id: new ObjectId(BookingID) };
      // const jobData = req.body;
      // const updateData = { $set: {...jobData} };
      const updateData = { $set: req.body };
      const result = await bookingCollection.updateOne(filter, updateData);
      res.send(result);
    });

    // delete my booking
    app.delete('/delete-booking/:id', verifyToken, async (req, res) => {
      const query = {
        _id: new ObjectId(req.params.id),
      };
      // decrease booking count 1 in service collection
      const paiyaGesi = await bookingCollection.findOne(query);
      const updateDoc = { $inc: { totalBookings: -1 } };
      const serviceQuery = { _id: new ObjectId(paiyaGesi.serviceId) };
      const updateBidCount = await serviceCollection.updateOne(
        serviceQuery,
        updateDoc
      );
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // get servies-to-do from booking collection
    app.get('/services-to-do', verifyToken, async (req, res) => {
      const result = await bookingCollection
        .find({ providerEmail: req?.query?.email })
        .toArray();
      res.send(result);
    });

    // update service status
    app.patch('/update-service-status/:id', verifyToken, async (req, res) => {
      const ID = req.params.id;
      const query = { _id: new ObjectId(ID) };
      const updateData = { $set: { serviceStatus: req.body.newStatus } };
      const result = await bookingCollection.updateOne(query, updateData);
      res.send(result);
    });


    // Send a ping to confirm a successful connection to DB
    // await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hellow! From GlamSpot server owner Khaled');
});

app.listen(port, () => {
  console.log(`GlamSpot server is running on port: ${port}`);
});

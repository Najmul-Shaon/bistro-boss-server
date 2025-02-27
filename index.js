const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
// This is your test secret API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// mail gun
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const { default: axios } = require("axios");
const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY || "key-yourkeyhere",
});

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// token verify middleware
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cwzf5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
    const usersCollection = client.db("bistroBossBD").collection("users");
    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //   create cart collection
    const cartCollection = client.db("bistroBossBD").collection("carts");
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    //   get cart data for specific user
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    //   cart delete api
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //   get all menu from menuCollection
    const menuCollection = client.db("bistroBossBD").collection("menu");

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    // menu item add into db
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    // menu item delete
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // menu info update by id>> get
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    // menu info update by id>> patch
    app.patch("/menu/:id", async (req, res) => {
      const id = req.params.id;

      const item = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //   get all reviews from review collecetion
    const rivewsCollection = client.db("bistroBossBD").collection("reviews");
    app.get("/reviews", async (req, res) => {
      const result = await rivewsCollection.find().toArray();
      res.send(result);
    });

    // user related api

    // create user into the db
    app.post("/users", async (req, res) => {
      const user = req.body;
      // check if the user is exist or not
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers);
      const resul = await usersCollection.find().toArray();
      res.send(resul);
    });

    // delete user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // user assign to admin role
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );

    // check user admin or not by email
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // const
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // jwt api's
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // stripe payment method
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // *************************************

    // Congratulations

    // Sandbox Store ID Created

    // We highly appreciate if you first connect with the sandbox and then move to the live system. Please inform us if you need to change Registered Store URL for testbox.

    // Store ID: snowf679a86cdb94db
    // Store Password (API/Secret Key): snowf679a86cdb94db@ssl

    // Merchant Panel URL: https://sandbox.sslcommerz.com/manage/ (Credential as you inputted in the time of registration)

    // Store name: testsnowfchul
    // Registered URL: www.bistroboss.com
    // Session API to generate transaction: https://sandbox.sslcommerz.com/gwprocess/v3/api.php
    // Validation API: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?wsdl
    // Validation API (Web Service) name: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php
    // *************************************

    // payment related api
    const paymentCollection = client.db("bistroBossBD").collection("payments");
    // ssl commerze
    app.post("/create-ssl-payment", async (req, res) => {
      const payment = req.body;
      // console.log(payment);

      const trxId = new ObjectId().toString();
      payment.trxId = trxId;

      const initiate = {
        store_id: "snowf679a86cdb94db",
        store_passwd: "snowf679a86cdb94db@ssl",
        total_amount: payment.price,
        currency: "BDT",
        tran_id: trxId, // use unique tran_id for each api call
        success_url: "http://localhost:5001/success",
        fail_url: "http://localhost:5173/fail",
        cancel_url: "http://localhost:5173/cancel",
        ipn_url: "http://localhost:5001/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: payment.email,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      const initiateResponse = await axios({
        url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
        method: "post",
        data: initiate,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const saveData = await paymentCollection.insertOne(payment);

      const gatewayUrl = initiateResponse?.data?.GatewayPageURL;

      console.log(gatewayUrl);
      res.send({ gatewayUrl });
    });

    app.post("/success-ssl-payment", async (req, res) => {
      const successPayment = req.body;
      console.log(successPayment);
    });

    // stripe

    // saved payment data
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // console.log(payment);

      // delete items from the cart
      const query = {
        _id: {
          $in: payment.cardIds.map((id) => new ObjectId(id)),
        },
      };

      //send msg to the user
      mg.messages
        .create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Excited User <mailgun@sandbox-123.mailgun.org>",
          to: ["najmul.nh.shaon@gmail.com"],
          subject: "Hello",
          text: "Testing some Mailgun awesomness!",
          html: "<h1>Testing some Mailgun awesomness!</h1>",
        })
        .then((msg) => console.log(msg)) // logs response data
        .catch((err) => console.error(err)); // logs any error

      const deleteResutl = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResutl });
    });

    // get payment to show the history
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { email: email };
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // statistics
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce(
      //   (total, paymentAmount) => total + paymentAmount.price,
      //   0
      // );

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({ users, menuItems, orders, revenue });
    });

    // order stats using aggregate pipeline
    app.get("/order-stats", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$menuItemIds",
          },
          {
            $lookup: {
              from: "menu",
              localField: "menuItemIds",
              foreignField: "_id",
              as: "menuItems",
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quantity: {
                $sum: 1,
              },
              revenue: { $sum: "$menuItems.price" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue",
            },
          },
        ])
        .toArray();
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`server is running ${port}`);
});

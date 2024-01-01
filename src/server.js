import express from "express";
import morgan from "morgan";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from 'path';
import mongoose from 'mongoose';
import helmet from 'helmet';
import session from 'express-session';
import MongoDBStorePackage from 'connect-mongodb-session';
import mongoSanitize from 'express-mongo-sanitize';
import { fileURLToPath } from 'url';
import { userProfileJoiObject, userHistoryJoiObject } from "./joiSchema.js";
import axios from "axios";
import admin from 'firebase-admin';

import cors from 'cors';
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if(process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
const credentials = {};
credentials['type'] = process.env.TYPE;
credentials['project_id'] = process.env.PROJECT_ID;
credentials['private_key_id'] = process.env.PRIVATE_KEY_ID;
credentials['private_key'] = process.env.PRIVATE_KEY;
credentials['client_email'] = process.env.CLIENT_EMAIL;
credentials['client_id'] = process.env.CLIENT_ID;
credentials['auth_uri'] = process.env.AUTH_URI;
credentials['token_uri'] = process.env.TOKEN_URI;
credentials['auth_provider_x509_cert_url'] = process.env.AUTH_PROVIDER_X509_CERT_URL;
credentials['client_x509_cert_url'] = process.env.CLIENT_X509_CERT_URL;
credentials['universe_domain'] = process.env.UNIVERSE_DOMAIN
admin.initializeApp({
    credential: admin.credential.cert(credentials),
});
const app = express();

app.use(helmet.crossOriginOpenerPolicy());
app.use(helmet.crossOriginResourcePolicy());
app.use(helmet.dnsPrefetchControl());
// app.use(helmet.expectCt());
app.use(helmet.frameguard());
app.use(helmet.hidePoweredBy());
app.use(helmet.hsts());
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
app.use(helmet.originAgentCluster());
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.referrerPolicy());
app.use(helmet.xssFilter());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json())
app.use(cors())

const scriptSrcUrls = [
  "https://stackpath.bootstrapcdn.com/",
  "https://api.tiles.mapbox.com/",
  "https://api.mapbox.com/",
  "https://kit.fontawesome.com/",
  "https://cdnjs.cloudflare.com/",
  "https://cdn.jsdelivr.net/",
];
const styleSrcUrls = [
  "https://kit-free.fontawesome.com/",
  "https://stackpath.bootstrapcdn.com/",
  "https://api.mapbox.com/",
  "https://api.tiles.mapbox.com/",
  "https://fonts.googleapis.com/",
  "https://use.fontawesome.com/",
  "https://cdn.jsdelivr.net/"
];
const connectSrcUrls = [
  "https://api.mapbox.com/",
  "https://a.tiles.mapbox.com/",
  "https://b.tiles.mapbox.com/",
  "https://events.mapbox.com/",
];
const fontSrcUrls = [];
app.use(
  helmet.contentSecurityPolicy({
      directives: {
          defaultSrc: [],
          connectSrc: ["'self'", ...connectSrcUrls],
          scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
          styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
          workerSrc: ["'self'", "blob:"],
          objectSrc: [],
          imgSrc: [
              "'self'",
              "blob:",
              "data:",
              "https://images.unsplash.com/",
          ],
          fontSrc: ["'self'", ...fontSrcUrls],
      }
  })
);

app.use(async (req, res, next) => {
  const { authtoken } = req.headers;
  if(authtoken) {
      try {
          req.user = await admin.auth().verifyIdToken(authtoken);
      }
      catch (e) {
          return res.sendStatus(400);
      }
  }
  req.user = req.user || {};
  next();
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, authtoken, file");
  next();
});

const dbUrl = process.env.DB_URL;
mongoose.connect(dbUrl);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log("connection open");
});

app.use(morgan("combined"));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use(mongoSanitize());
const secret = process.env.SECRET;
const MongoDBStore = MongoDBStorePackage(session);
const store = new MongoDBStore({
    uri : dbUrl,
    secret: secret,
    touchAfter: 24 * 60 * 60
});

store.on('error', function(error) {
    console.log("Session Store Error", error);
})
app.use(session({
    store,
    name: 'session',
    secret: secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        //secure: true,
        expires: Date.now() + 1000 * 60 * 60,
        maxAge: 1000 * 60 * 60
    }
}));
const Schema = mongoose.Schema;
const UserProfileSchema = new Schema({
  firebase_id: String,
  name: String,
  email: String, 
  age: Number,
  country: String,
  state: String,
  phone_number: Number
});

const UserProfile = mongoose.model('UserProfile', UserProfileSchema);

const UserHistorySchema = new Schema({
  firebase_id: String,
  destinationName: [String],
  hotelName: [String],
  rating: [Number],
  price: [Number],
  daysStayed: [Number]
});

const UserHistory = mongoose.model('UserHistory', UserHistorySchema);


app.get('/api/getProfileID/:id', async (req, res) => {
  if(req.user && (req.user.user_id === req.params.id)) {
      const id = req.params.id;
      const data = await UserProfile.findOne({"firebase_id": id});
      if(data) res.status(200).send(data._id);
      else res.status(400).send("Failure");
  } else {
      res.status(400).send("Failure");
  }
})

app.get('/api/getHistoryID/:id', async (req, res) => {
  if(req.user && (req.user.user_id === req.params.id)) {
      const id = req.params.id;
      console.log(id);
      const data = await UserHistory.findOne({"firebase_id": id});
      if(data) res.status(200).send(data._id);
      else res.status(400).send("Failure");
  } else {
      res.status(400).send("Failure");
  }
})

app.post("/createProfile", async (req, res) => {
  try{
    const obj = req.body;
    
    const {error} = userProfileJoiObject.validate(obj);
    if(error) {
      throw error;
    }

    const userProfileObj = new UserProfile(obj);
    await userProfileObj.save();

    res.status(200).send("Success");
  } catch(err) {
    console.log(err);
    res.status(400).send("Failure");
  }
})

app.post("/addUserHistory/:id", async (req, res) => {
  try{
    const id = req.params.id;
    const requestObj = req.body;
    const obj = {};
    const data = await UserHistory.findById(id);

    if(data !== null) {
      obj.firebase_id = requestObj.firebase_id;
      data.destinationName.push(requestObj.destinationName);
      data.hotelName.push(requestObj.hotelName);
      data.rating.push(requestObj.rating);
      data.price.push(requestObj.price);
      data.daysStayed.push(requestObj.daysStayed);

      obj.destinationName = data.destinationName;
      obj.hotelName = data.hotelName;
      obj.rating = data.rating;
      obj.price = data.price;
      obj.daysStayed = data.daysStayed;

      const {error} = userHistoryJoiObject.validate(obj);
      if(error) {
        throw error;
      }

      
      await UserHistory.findByIdAndUpdate(id, obj, {new: true});
    }
    else {
      obj.firebase_id = requestObj.firebase_id;
      obj.destinationName = [requestObj.destinationName];
      obj.hotelName = [requestObj.hotelName];
      obj.rating = [requestObj.rating];
      obj.price = [requestObj.price];
      obj.daysStayed = [requestObj.daysStayed];

      const {error} = userHistoryJoiObject.validate(obj);
      if(error) {
        throw error;
      }

      const userHistoryObject = new UserHistory(obj);
      await userHistoryObject.save();
    }
    

    res.status(200).send("Success");
  } catch(err) {
    console.log(err);
    res.status(400).send("Failure");
  }
})

app.get("/getUserProfile/:id", async (req, res) => {
  const id = req.params.id;
  try {
      const data = await UserProfile.findById(id);
      res.json(data);
  }
  catch(e) {
      res.status(404).send(`error: ${e}`);
  }
})

app.get("/getUserHistory/:id", async (req, res) => {
  const id = req.params.id;
  try {
      const data = await UserHistory.findById(id);
      res.json(data);
  }
  catch(e) {
      res.status(404).send(`error: ${e}`);
  }
})

app.get("/",  (req, res) => {
  res.send("Hello, Welcome to My backend!!");
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/extract-keywords", async (req, res) => {
    try {
        const {prompt} = req.body
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                "role": "system",
                "content": "You will be provided with a block of text, and your task is to extract a list of keywords from it."
              },
              {
                "role": "user",
                "content": `${prompt}`
              }
            ],
            temperature: 0.5,
            max_tokens: 64,
            top_p: 1,
          });


        return res.status(200).json({
            success: "true",
            data: response.choices[0].message.content
        })
    } catch (error) {
        res.status(400).json({
            success: "false",
            error: error.response ? error.response.data : "There was an issue with the server"
        })
    }
})

app.post("/get-hotels", async (req, res) => {
  try {
        const username = "hackathontest";
        const password = "Hac@48298799";
        const credentials = btoa(username + ":" + password);
        const basicAuth = "Basic " + credentials;
        const apiUrl =
          "http://api.tbotechnology.in/TBOHolidays_HotelAPI/HotelSearch";
        const data = req.body.data
        const response = await axios.post(apiUrl, data, {
          headers: {
            "Content-Type": "application/json",
            Authorization: basicAuth,
          },
        });
        console.log(response.data.HotelSearchResults);
        return res.status(200).json({
          success: "true",
          data: response.data.HotelSearchResults
      })
      }catch (error) {
      res.status(400).json({
      success: "false",
      error: error.response ? error.response.data : "There was an issue with the server"
  })
  }
})




const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`Server is running http://localhost:${port}`);
});

  

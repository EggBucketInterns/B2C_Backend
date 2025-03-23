import express, { urlencoded } from "express";
import admin from "firebase-admin"; // Only server-side needed
import NotFound from "./errors/notFound.js";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import customerRouter from "./routes/customerRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import deliveryPartnerRouter from "./routes/deliveryPartnerRouter.js";
import adminRouter from "./routes/adminRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import errorHandler from "./middleware/errorHandler.js";
import firebaseRoute from "./routes/FirebaseRoute.js"

// Initialize Firebase Admin SDK only once
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.TYPE,
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\\\n/g, "\n"),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
    universe_domain: "googleapis.com",
  }),
});

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/customer", customerRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/deliveryPartner", deliveryPartnerRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api", firebaseRoute);

app.all("*", (req, res, next) => {
  throw new NotFound("Invalid route");
});


app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
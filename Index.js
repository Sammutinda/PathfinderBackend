const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const consumerKey = "YOUR_CONSUMER_KEY"; // Replace with Daraja Consumer Key
const consumerSecret = "YOUR_CONSUMER_SECRET"; // Replace with Daraja Consumer Secret
const shortCode = "174379"; // Sandbox Paybill for testing
const passkey = "YOUR_PASSKEY"; // Replace with Daraja sandbox Passkey
const callbackUrl = "https://your-render-backend.onrender.com/callback"; // Replace with Render URL

// Generate OAuth token
async function getAccessToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data.access_token;
}

// Initiate STK Push
app.post("/initiate-payment", async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference } = req.body;
    const token = await getAccessToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, -3);
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: "NjiaFinder Kenya Test Payment",
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({
      success: true,
      checkoutRequestID: response.data.CheckoutRequestID,
    });
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
    res.json({ success: false, message: "Payment initiation failed" });
  }
});

// Handle M-Pesa callback
let paymentStatus = {};

app.post("/callback", (req, res) => {
  const data = req.body.Body.stkCallback;
  const checkoutRequestID = data.CheckoutRequestID;
  if (data.ResultCode === 0) {
    paymentStatus[checkoutRequestID] = "success";
  } else {
    paymentStatus[checkoutRequestID] = "failed";
  }
  res.json({ success: true });
});

// Check payment status
app.post("/check-payment", (req, res) => {
  const { checkoutRequestID } = req.body;
  const status = paymentStatus[checkoutRequestID] || "pending";
  res.json({ success: true, status });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

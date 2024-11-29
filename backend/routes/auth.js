const express = require('express');
const router = express.Router();
const twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post('/verify', async (req, res) => {
  const { phoneNumber } = req.body;

  console.log('Attempting to send SMS to:', phoneNumber);

  try {
    if (!phoneNumber.match(/^\+1671\d{7}$/)) {
      console.log('Invalid phone number format');
      return res.status(400).json({
        error: 'Only Guam phone numbers are supported (+1671XXXXXXX)'
      });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Generated verification code:', verificationCode);

    // Make sure Twilio phone number has + prefix
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER.startsWith('+')
      ? process.env.TWILIO_PHONE_NUMBER
      : `+${process.env.TWILIO_PHONE_NUMBER}`;

    console.log('Using Twilio number:', twilioNumber);

    const message = await twilioClient.messages.create({
      body: `Your townhall.town verification code is: ${verificationCode}`,
      from: twilioNumber,
      to: phoneNumber
    });

    console.log('SMS sent successfully:', {
      messageId: message.sid,
      status: message.status
    });

    // Store the code
    global.verificationCodes = global.verificationCodes || {};
    global.verificationCodes[phoneNumber] = verificationCode;

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      error: 'Failed to send SMS',
      details: error.message
    });
  }
});

module.exports = router;
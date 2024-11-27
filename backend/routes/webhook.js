const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

router.post(
  '/',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

    // Log the signature header
    console.log('Signature header:', sig);

    // Log the request body
    const rawBody = req.body;
    const rawBodyLength = rawBody.length;
    const rawBodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');

    console.log('Request body:', {
      isBuffer: Buffer.isBuffer(rawBody),
      length: rawBodyLength,
      hash: rawBodyHash,
      type: typeof rawBody,
    });

    try {
      // Verify the webhook signature
      const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

      console.log('Event verified:', event.type);

      // Handle the checkout.session.completed event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('Processing checkout session:', {
          id: session.id,
          email: session.customer_email
        });

        // Update purchase status in MongoDB
        const Purchase = require('../models/Purchase');
        const result = await Purchase.findOneAndUpdate(
          { email: session.customer_email },
          {
            $set: {
              hasPurchased: true,
              purchaseDate: new Date(),
              stripeSessionId: session.id,
              priceId: session.line_items?.data[0]?.price?.id,
              amount: session.amount_total
            }
          },
          { upsert: true, new: true }  // Return updated document
        );

        console.log('Purchase recorded:', {
          email: session.customer_email,
          hasPurchased: result.hasPurchased,
          purchaseDate: result.purchaseDate
        });
      }

      res.status(200).send('Success');
    } catch (err) {
      console.error('Webhook error:', {
        message: err.message,
        type: err.type,
        stack: err.stack?.split('\n')[0]
      });
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

module.exports = router;

import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    items: [
      {
        productId: String,
        name: String,
        price: Number,
        qty: Number,
      },
    ],
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    customer: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    // Buyer's Telegram, used to continue the order + send confirmation.
    telegramId: { type: String, default: '' },
    telegramUsername: { type: String, default: '' },
    // Customization for the printed card — fields the buyer set in the shop's
    // designer, carried here so whoever fulfills the order has the print data.
    cardDesign: {
      template: { type: String, default: '' },
      name: { type: String, default: '' },
      tagline: { type: String, default: '' },
      handle: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      profileUrl: { type: String, default: '' },
    },
    // How the buyer wants the printed card delivered.
    delivery: {
      method: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
      area: { type: String, default: '' }, // 'phnom-penh' | 'province' (delivery only)
      courier: { type: String, default: '' }, // provincial courier (province only)
      address: { type: String, default: '' }, // delivery address (delivery only)
      fee: { type: Number, default: 0 }, // server-set delivery fee folded into amount
    },
    status: { type: String, enum: ['pending', 'paid', 'expired'], default: 'pending' },
    paidAt: Date,
    fulfilled: { type: Boolean, default: false },
    // Post-payment fulfillment stage; admin advances it, buyer is notified.
    stage: { type: String, enum: ['preparing', 'printing', 'dispatched', 'completed'], default: 'preparing' },
    // Two-way message thread between admin and buyer (mirrored over Telegram).
    messages: [
      {
        from: { type: String, enum: ['admin', 'buyer'], required: true },
        text: { type: String, default: '' },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model('Order', orderSchema);

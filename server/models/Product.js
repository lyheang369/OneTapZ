import mongoose from 'mongoose';

// Shop catalog product. Prices live here (server-authoritative) and are
// editable from the admin dashboard. `discountPrice` of 0 means no discount;
// the effective (charged) price is min(discountPrice, price) when a discount is set.
const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('Product', productSchema);

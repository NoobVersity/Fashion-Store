import { getDb } from './db.js';
import { createSchema } from './schema.js';
import { hashPassword } from '../services/passwordService.js';
import { saveSettings, DEFAULT_SETTINGS } from '../services/settingsService.js';
import { slugify } from '../validation/validate.js';

/**
 * Demo seed data — every name, email and product here is fictional.
 * Safe to rerun: existing data is never overwritten. To start over
 * from scratch use `npm run db:reset`.
 *
 * The initial administrator is created from environment variables
 * (see .env.example): ADMIN_EMAIL + ADMIN_PASSWORD. The seed command
 * refuses to run without them, so no default password is ever shipped.
 */

const CATEGORIES = [
  { name: 'Tops', description: 'T-shirts, shirts and knits for everyday layering.' },
  { name: 'Bottoms', description: 'Jeans, trousers and skirts with clean lines.' },
  { name: 'Outerwear', description: 'Jackets, blazers and coats for transitional weather.' },
  { name: 'Accessories', description: 'Bags, scarves and small finishing pieces.' },
];

const PRODUCTS = [
  {
    name: 'Oversized Cotton Tee',
    category: 'Tops',
    price: 2900,
    description:
      'A relaxed everyday tee in heavyweight organic cotton. Dropped shoulders, boxy fit, pre-washed to stay soft.',
    variants: [
      { size: 'S', color: 'Black', stock: 14 },
      { size: 'M', color: 'Black', stock: 22 },
      { size: 'M', color: 'Off White', stock: 9 },
      { size: 'L', color: 'Black', stock: 12 },
      { size: 'L', color: 'Off White', stock: 6 },
      { size: 'XL', color: 'Black', stock: 4 },
    ],
  },
  {
    name: 'Linen Blend Shirt',
    category: 'Tops',
    price: 5900,
    description:
      'A breathable camp-collar shirt in a linen-cotton blend. Cut straight, meant to be worn open or tucked.',
    variants: [
      { size: 'S', color: 'Sand', stock: 7 },
      { size: 'M', color: 'Sand', stock: 11 },
      { size: 'M', color: 'Sky Blue', stock: 5 },
      { size: 'L', color: 'Sand', stock: 8 },
      { size: 'L', color: 'Sky Blue', stock: 3 },
    ],
  },
  {
    name: 'Ribbed Tank Top',
    category: 'Tops',
    price: 2400,
    description:
      'A close-fitting ribbed tank in a cotton-stretch knit. A quiet base layer for warmer days.',
    variants: [
      { size: 'XS', color: 'Ivory', stock: 6 },
      { size: 'S', color: 'Ivory', stock: 13 },
      { size: 'S', color: 'Charcoal', stock: 10 },
      { size: 'M', color: 'Charcoal', stock: 15 },
    ],
  },
  {
    name: 'High-Rise Straight Jeans',
    category: 'Bottoms',
    price: 8900,
    description:
      'Rigid denim with a high rise and a straight leg. Selvedge edge, button fly, no stretch — they break in with wear.',
    variants: [
      { size: '26', color: 'Indigo', stock: 5 },
      { size: '28', color: 'Indigo', stock: 9 },
      { size: '28', color: 'Black', stock: 4 },
      { size: '30', color: 'Indigo', stock: 11 },
      { size: '32', color: 'Indigo', stock: 6 },
    ],
  },
  {
    name: 'Tailored Wool Trousers',
    category: 'Bottoms',
    price: 9900,
    description:
      'Mid-weight wool trousers with a pressed crease and a tapered ankle. Half-lined for comfort.',
    variants: [
      { size: 'S', color: 'Charcoal', stock: 6 },
      { size: 'M', color: 'Charcoal', stock: 9 },
      { size: 'M', color: 'Camel', stock: 4 },
      { size: 'L', color: 'Camel', stock: 7 },
    ],
  },
  {
    name: 'Pleated Midi Skirt',
    category: 'Bottoms',
    price: 6500,
    description:
      'A knife-pleated midi in fluid crepe that moves easily from desk to evening. Side zip, concealed pockets.',
    variants: [
      { size: 'XS', color: 'Emerald', stock: 3 },
      { size: 'S', color: 'Emerald', stock: 8 },
      { size: 'S', color: 'Black', stock: 12 },
      { size: 'M', color: 'Black', stock: 10 },
    ],
  },
  {
    name: 'Boxy Wool Blazer',
    category: 'Outerwear',
    price: 14900,
    description:
      'A softly structured double-breasted blazer in boiled wool. Dropped shoulder, satin lining, no padding.',
    variants: [
      { size: 'S', color: 'Camel', stock: 4 },
      { size: 'M', color: 'Camel', stock: 6 },
      { size: 'M', color: 'Black', stock: 5 },
      { size: 'L', color: 'Black', stock: 3 },
    ],
  },
  {
    name: 'Oversized Denim Jacket',
    category: 'Outerwear',
    price: 11900,
    description:
      'A washed rigid-denim jacket cut two sizes up. Chest flap pockets, adjustable waist tabs.',
    variants: [
      { size: 'S', color: 'Washed Blue', stock: 5 },
      { size: 'M', color: 'Washed Blue', stock: 8 },
      { size: 'L', color: 'Washed Blue', stock: 6 },
      { size: 'XL', color: 'Washed Blue', stock: 2 },
    ],
  },
  {
    name: 'Quilted Puffer Vest',
    category: 'Outerwear',
    price: 9900,
    description:
      'A lightweight recycled-fill vest with a stand collar. Packs flat into its own pocket.',
    variants: [
      { size: 'M', color: 'Black', stock: 2 },
      { size: 'M', color: 'Olive', stock: 3 },
      { size: 'L', color: 'Black', stock: 1 },
    ],
  },
  {
    name: 'Leather Belt Bag',
    category: 'Accessories',
    price: 7900,
    description:
      'A compact belt bag in vegetable-tanned leather. Wear it at the waist or across the chest.',
    variants: [
      { size: 'One Size', color: 'Tan', stock: 7 },
      { size: 'One Size', color: 'Black', stock: 9 },
    ],
  },
  {
    name: 'Silk Scarf',
    category: 'Accessories',
    price: 4500,
    description:
      'A square scarf in hand-rolled silk twill with a printed grid motif. 65 × 65 cm.',
    variants: [
      { size: 'One Size', color: 'Burgundy', stock: 0 },
      { size: 'One Size', color: 'Ivory', stock: 10 },
    ],
  },
  {
    name: 'Ribbed Knit Beanie',
    category: 'Accessories',
    price: 2500,
    is_active: false,
    description:
      'A fine-gauge ribbed beanie in merino wool. Currently between seasons — deactivated by the store team.',
    variants: [
      { size: 'One Size', color: 'Cream', stock: 12 },
      { size: 'One Size', color: 'Rust', stock: 8 },
    ],
  },
];

const DISCOUNTS = [
  {
    code: 'THREADS10',
    discount_type: 'percentage',
    discount_value: 10,
    minimum_order_value: 0,
    starts_at: null,
    expires_at: null,
    usage_limit: null,
    is_active: 1,
    description: '10% off any order — general demo code.',
  },
  {
    code: 'WELCOME15',
    discount_type: 'percentage',
    discount_value: 15,
    minimum_order_value: 5000,
    starts_at: null,
    expires_at: null,
    usage_limit: 100,
    is_active: 1,
    description: '15% off orders above $50 — first-order style code.',
  },
  {
    code: 'SAVE5',
    discount_type: 'fixed',
    discount_value: 500,
    minimum_order_value: 8000,
    starts_at: null,
    expires_at: null,
    usage_limit: 50,
    is_active: 1,
    description: '$5 off orders above $80 — fixed-amount example.',
  },
  {
    code: 'SUMMER24',
    discount_type: 'percentage',
    discount_value: 20,
    minimum_order_value: 0,
    starts_at: null,
    expires_at: '2024-08-31T23:59:59.000Z',
    usage_limit: null,
    is_active: 1,
    description: 'Expired campaign code — kept to demo expiry validation.',
  },
  {
    code: 'STAFF25',
    discount_type: 'percentage',
    discount_value: 25,
    minimum_order_value: 0,
    starts_at: null,
    expires_at: null,
    usage_limit: null,
    is_active: 0,
    description: 'Inactive code — kept to demo the active/inactive switch.',
  },
];

function seedAdmin() {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (existing) {
    console.log('• Admin: already exists — left untouched.');
    return;
  }
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) {
    throw new Error(
      'No administrator exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env ' +
        '(see .env.example) and run `npm run db:seed` again.'
    );
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long.');
  }
  db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(
    email,
    hashPassword(password)
  );
  console.log(`• Admin: created administrator ${email} (password not shown).`);
}

export function seedDatabase({ verbose = true } = {}) {
  const log = verbose ? (...args) => console.log(...args) : () => {};
  const db = getDb();
  createSchema(db);

  seedAdmin();

  // ---- categories ---------------------------------------------------
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)'
  );
  let newCategories = 0;
  for (const category of CATEGORIES) {
    const exists = db
      .prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE')
      .get(category.name);
    if (!exists) {
      insertCategory.run(category.name, slugify(category.name), category.description);
      newCategories += 1;
    }
  }
  log(`• Categories: ${newCategories} added (${CATEGORIES.length} total in demo set).`);

  // ---- products + variants -------------------------------------------
  if (db.prepare('SELECT COUNT(*) AS c FROM products').get().c === 0) {
    const insertProduct = db.prepare(
      `INSERT INTO products (category_id, name, slug, description, price, image_path, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertVariant = db.prepare(
      'INSERT INTO product_variants (product_id, size, color, stock_quantity) VALUES (?, ?, ?, ?)'
    );
    const seedAll = db.transaction(() => {
      for (const product of PRODUCTS) {
        const category = db
          .prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE')
          .get(product.category);
        const slug = slugify(product.name);
        const info = insertProduct.run(
          category.id,
          product.name,
          slug,
          product.description,
          product.price,
          `/images/products/${slug}.svg`,
          product.is_active === false ? 0 : 1
        );
        const productId = Number(info.lastInsertRowid);
        for (const variant of product.variants) {
          insertVariant.run(productId, variant.size, variant.color, variant.stock);
        }
      }
    });
    seedAll();
    log(`• Products: ${PRODUCTS.length} seeded with size/color variants.`);
  } else {
    log('• Products: already present — left untouched.');
  }

  // ---- discounts -------------------------------------------------------
  const insertDiscount = db.prepare(
    `INSERT INTO discounts (code, discount_type, discount_value, minimum_order_value,
                            starts_at, expires_at, usage_limit, is_active, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let newDiscounts = 0;
  for (const d of DISCOUNTS) {
    const exists = db
      .prepare('SELECT id FROM discounts WHERE code = ? COLLATE NOCASE')
      .get(d.code);
    if (!exists) {
      insertDiscount.run(
        d.code,
        d.discount_type,
        d.discount_value,
        d.minimum_order_value,
        d.starts_at,
        d.expires_at,
        d.usage_limit,
        d.is_active,
        d.description
      );
      newDiscounts += 1;
    }
  }
  log(`• Discounts: ${newDiscounts} added (THREADS10, WELCOME15, SAVE5, SUMMER24 expired, STAFF25 inactive).`);

  // ---- store settings (only fill missing keys) ---------------------------
  const settings = db.prepare('SELECT key FROM store_settings').all().map((r) => r.key);
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!settings.includes(key)) missing[key] = value;
  }
  if (Object.keys(missing).length > 0) {
    saveSettings(missing);
    log('• Settings: defaults applied for missing keys.');
  } else {
    log('• Settings: already present — left untouched.');
  }

  log('Seed complete.');
}

// CLI: npm run db:seed
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    seedDatabase();
  } catch (err) {
    console.error(`Seed failed: ${err.message}`);
    process.exit(1);
  }
}

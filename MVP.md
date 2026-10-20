# THREADS --- Fashion Store MVP Specification

## 1. Project Overview

**Project name:** THREADS\
**Project type:** Fashion e-commerce website with a separate
administration area\
**Purpose:** A lightweight, maintainable university project that
demonstrates a realistic online clothing store and a secure admin
dashboard.

THREADS sells clothing and fashion accessories. Customers can browse
products, search and filter the catalog, manage a cart, and place test
orders using a simulated checkout flow. Administrators manage the store
through a separate admin area.

### MVP goals

-   Deliver a polished, responsive storefront.
-   Provide a functional admin dashboard with full management of store
    data.
-   Persist application data in SQLite.
-   Keep the source-code submission ZIP under **10 MB**, excluding
    installed dependencies and generated build output.
-   Keep the architecture simple enough for a student to understand and
    extend.
-   Use English throughout the storefront, admin interface, seed data,
    and documentation.

### Out of scope for the MVP

-   Real payment processing or storing card details.
-   Real shipping-carrier integrations.
-   Multi-vendor marketplace features.
-   Microservices or a separate frontend/backend repository.
-   Mandatory third-party accounts or paid APIs.

## 2. Technology Stack

Use the following stack unless a compatibility issue requires a clearly
documented alternative:

-   **Frontend:** React, Vite, and plain CSS or CSS Modules.
-   **Backend:** Node.js and Express.
-   **Database:** SQLite.
-   **Database access:** A small, actively maintained SQLite library
    compatible with the chosen Node.js version.
-   **Authentication:** Server-side session-based authentication with
    secure password hashing.
-   **Validation:** Server-side validation for all write operations.
-   **Testing:** A small set of meaningful automated tests for core API
    behavior and authorization.

Keep the project in a single repository with separate frontend and
backend directories. Avoid adding libraries that do not provide a clear
MVP benefit.

## 3. Project Structure

Use a structure similar to this:

``` text
threads-fashion-store/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── admin/
│   │   ├── services/
│   │   ├── styles/
│   │   └── main.jsx
│   ├── public/
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── database/
│   │   ├── validation/
│   │   └── app.js
│   ├── package.json
│   └── .env.example
├── .gitignore
├── README.md
└── MVP.md
```

The exact structure may vary slightly, but keep modules clear and avoid
unnecessary abstraction.

## 4. Routing and Separation of the Admin Area

The administration area must feel like a separate part of a real
website.

-   The public storefront is available at `/`.
-   The admin login page is available at `/admin/login`.
-   The admin dashboard is available at `/admin`.
-   Admin sections use routes such as `/admin/products`,
    `/admin/orders`, and `/admin/settings`.
-   **Do not add an Admin, Dashboard, or Admin Login button or link to
    the public storefront navigation, footer, or customer-facing
    pages.**
-   Users who know the URL can navigate directly to `/admin/login`.
-   Visiting `/admin` while unauthenticated must redirect to
    `/admin/login`.
-   After a successful admin login, redirect to `/admin`.
-   An authenticated administrator who visits `/admin/login` should be
    redirected to `/admin`.
-   The admin area must have its own layout, sidebar, top bar,
    navigation, and visual style. Do not reuse the public storefront
    header or shopping navigation.
-   The admin interface may share reusable low-level UI components, but
    it should be visually and structurally distinct.
-   Hiding the admin link is not a security measure. Every protected
    backend endpoint must independently verify authorization.

For local development, configure Vite to proxy API requests to Express
or document a simple, reliable alternative. In production, the frontend
and API should be configured to work under the same origin where
practical, simplifying secure session handling.

## 5. Storefront Requirements

### 5.1 Home page

Include:

-   A clean, modern fashion-store hero section.
-   A short brand introduction.
-   Featured products.
-   Product categories.
-   A clear call to action that leads to the product catalog.
-   A simple footer with store contact information and basic links.

Do not place any admin access link on this page.

### 5.2 Product catalog

Customers can:

-   Browse active products.
-   Search by product name.
-   Filter by category, size, and price range.
-   Sort by price or newest.
-   Open a product details page.
-   See product image, name, price, category, available sizes, available
    colors, and stock status.

Out-of-stock products should be clearly marked. They must not be
orderable.

### 5.3 Product details

Each product page should show:

-   Product name and description.
-   Price.
-   Product image.
-   Category.
-   Available sizes and colors.
-   Stock availability.
-   Quantity selector limited by available stock.
-   Add-to-cart action.

If a selected size or color is unavailable, the customer must not be
able to add that variant to the cart.

### 5.4 Shopping cart

Customers can:

-   Add products to the cart.
-   Change quantities.
-   Remove items.
-   View subtotal and any applicable discount.
-   Enter a discount code, if valid.
-   Continue to checkout.

Revalidate product prices, stock, and discount rules on the server
during checkout. Never trust prices or totals submitted by the browser.

For the MVP, a cart may be stored in browser state or local storage. The
server remains authoritative when creating an order.

### 5.5 Checkout and simulated payment

Use a **simulated payment flow only**. Do not integrate a real payment
gateway and do not collect or store card information.

The checkout form collects only the information needed for a demo order:

-   Customer name.
-   Email address.
-   Phone number (optional if not needed for the course requirements).
-   Shipping address.
-   Optional order note.

At checkout:

1.  Validate required fields.
2.  Fetch current product prices and stock from the database.
3.  Validate the selected variants and quantities.
4.  Validate any discount code.
5.  Calculate the final amount on the server.
6.  Create an order and its order items in a database transaction.
7.  Reduce stock safely.
8.  Mark the payment method as `simulated` and payment status as
    `pending` or `simulated`.
9.  Display an order confirmation with the order number and summary.

Clearly label the checkout as a demo/simulated payment. Do not imply
that real money has been charged. Prevent duplicate submissions from
creating duplicate orders where practical.

### 5.6 Customer accounts

Keep the MVP manageable. Customers may check out as guests. Do not
require customer registration unless it is needed for the course
requirements. If customer accounts are implemented, password hashing and
server-side authorization are mandatory.

## 6. Admin Dashboard

The admin area must support real, persistent changes. It must not be a
static mockup.

### 6.1 Dashboard overview

At `/admin`, show useful summary cards such as:

-   Total products.
-   Active products.
-   Total orders.
-   Pending orders.
-   Total registered customers or unique guest customers, where
    meaningful.
-   Total order value for a clearly defined period.

Include a small recent-orders table. All figures must come from database
queries rather than hard-coded values.

### 6.2 Product management

At `/admin/products`, administrators can:

-   View products in a searchable, paginated table.
-   Create a product.
-   Edit every normal product field.
-   Activate or deactivate a product.
-   Delete a product when safe to do so.
-   Manage price, description, category, image, sizes, colors, and
    stock.
-   See validation errors and success/failure messages.

Product fields:

-   Name.
-   URL-friendly slug or unique identifier.
-   Description.
-   Price.
-   Category.
-   Image path or URL.
-   Available sizes.
-   Available colors.
-   Stock quantity, including variant-level stock if implemented.
-   Active/inactive status.
-   Created and updated timestamps.

Use a simple product-variant model if needed to track size/color stock
correctly. If using a simplified stock model, document the limitation
clearly and ensure order validation is consistent with it.

Products already referenced by order history should normally be
archived/deactivated rather than hard-deleted. If deletion is allowed,
preserve order history and avoid broken references.

### 6.3 Category management

Administrators can:

-   View categories.
-   Create categories.
-   Rename and edit category descriptions.
-   Activate/deactivate categories.
-   Delete a category only when it has no products, or require products
    to be reassigned first.

Category names must be unique.

### 6.4 Order management

At `/admin/orders`, administrators can:

-   View orders with search and status filters.
-   Open order details.
-   View customer and shipping details needed to fulfill the demo order.
-   View order items, quantities, unit prices, discount, and final
    total.
-   Change order status using valid transitions.
-   View payment method and payment status.
-   Cancel an order when allowed.

Suggested order statuses:

-   `pending`
-   `processing`
-   `shipped`
-   `delivered`
-   `cancelled`

Do not permit nonsensical transitions without a clear rule. Cancelling
an order must restore stock exactly once when stock was deducted. Use a
transaction to keep the order status and stock consistent.

Order items must preserve the product name and unit price at the time of
purchase so later product edits do not rewrite historical orders.

### 6.5 Customer management

At `/admin/customers`, administrators can:

-   View customer records and guest-order contact details.
-   Search by name or email.
-   View a customer's order history.
-   Update permitted contact fields if appropriate.
-   Disable or enable a registered customer account if accounts are
    implemented.

Only collect and display information necessary for the project. Do not
provide an admin feature to view customer passwords. Never store
passwords in plain text.

### 6.6 Discount management

At `/admin/discounts`, administrators can:

-   Create, edit, activate, and deactivate discount codes.
-   Set a code, discount type, value, optional minimum order value,
    start/end dates, and optional usage limit.
-   Choose percentage or fixed-amount discounts.
-   Validate discounts on the server.
-   Prevent expired, inactive, exhausted, or otherwise invalid codes
    from being used.

Validate that percentage discounts are within a sensible range and that
a discount cannot make the order total negative.

### 6.7 Inventory management

Provide a clear way to view and update stock. Show low-stock and
out-of-stock products. Stock changes must be persisted and must not
permit negative inventory.

### 6.8 Store settings

At `/admin/settings`, allow administrators to edit basic settings such
as:

-   Store display name.
-   Contact email.
-   Contact phone.
-   Currency display (use one configured currency consistently).
-   Low-stock threshold.
-   Basic store description.

Validate settings on the server. Do not expose secrets or environment
variables in this screen.

### 6.9 Admin account and authentication

Provide an admin login and logout flow. A password-change screen is
desirable for the MVP.

-   Store password hashes using a suitable password-hashing algorithm.
-   Use secure, HTTP-only cookies for session identifiers.
-   Set `SameSite` appropriately and use `Secure` cookies in production
    over HTTPS.
-   Regenerate the session after login.
-   Destroy the session on logout.
-   Protect all admin pages and all admin API endpoints.
-   Add basic login rate limiting.
-   Never ship a publicly accessible default admin password.
-   Create the initial admin using a documented local setup/seed command
    and credentials supplied through environment variables or a one-time
    local setup process.
-   Include `.env.example`, but never include a real `.env` file or real
    credentials in the submission.
-   Validate authorization on the server; frontend route guards are only
    a user-experience feature.

For a single-admin university MVP, a role system may remain simple. If
multiple admin accounts are supported, enforce the role on every
protected endpoint and prevent the last active administrator from being
removed or demoted.

## 7. Database Design

Use SQLite with foreign-key enforcement enabled. Create tables through
migrations or a repeatable initialization script.

Suggested tables:

### `admins`

-   `id`
-   `email` (unique)
-   `password_hash`
-   `created_at`
-   `updated_at`

### `categories`

-   `id`
-   `name` (unique)
-   `description`
-   `is_active`
-   `created_at`
-   `updated_at`

### `products`

-   `id`
-   `category_id` (foreign key)
-   `name`
-   `slug` (unique)
-   `description`
-   `price`
-   `image_path`
-   `is_active`
-   `created_at`
-   `updated_at`

### `product_variants` (recommended)

-   `id`
-   `product_id` (foreign key)
-   `size`
-   `color`
-   `stock_quantity`
-   Unique combination of product, size, and color

### `customers` (optional if guest-only checkout is used)

-   `id`
-   `name`
-   `email`
-   `phone`
-   `created_at`
-   `updated_at`

### `discounts`

-   `id`
-   `code` (unique)
-   `discount_type`
-   `discount_value`
-   `minimum_order_value`
-   `starts_at`
-   `expires_at`
-   `usage_limit`
-   `usage_count`
-   `is_active`
-   `created_at`
-   `updated_at`

### `orders`

-   `id`
-   `order_number` (unique)
-   `customer_id` (nullable for guest orders)
-   `customer_name`
-   `customer_email`
-   `customer_phone`
-   `shipping_address`
-   `order_note`
-   `subtotal`
-   `discount_amount`
-   `total`
-   `order_status`
-   `payment_method`
-   `payment_status`
-   `stock_restored` (or an equivalent reliable mechanism)
-   `created_at`
-   `updated_at`

### `order_items`

-   `id`
-   `order_id` (foreign key)
-   `product_id` (nullable if product is later removed)
-   `product_name_snapshot`
-   `variant_snapshot`
-   `unit_price`
-   `quantity`
-   `line_total`

### `store_settings`

-   `key` (primary key)
-   `value`
-   `updated_at`

Use foreign keys, unique constraints, and appropriate indexes. Store
monetary values as integer minor units (for example, cents) or another
consistent representation that avoids floating-point rounding errors.
Document the currency used.

## 8. API Requirements

Use REST-style endpoints under `/api`. Return consistent JSON responses
and appropriate HTTP status codes.

### Public endpoints

-   `GET /api/products`
-   `GET /api/products/:slug`
-   `GET /api/categories`
-   `POST /api/checkout`
-   `POST /api/discounts/validate` (or an equivalent checkout validation
    endpoint)
-   `GET /api/store-settings/public`

### Admin authentication endpoints

-   `POST /api/admin/auth/login`
-   `POST /api/admin/auth/logout`
-   `GET /api/admin/auth/me`
-   `POST /api/admin/auth/change-password` (if password change is
    included)

### Admin management endpoints

-   CRUD endpoints for `/api/admin/products`
-   CRUD endpoints for `/api/admin/categories`
-   Read/update endpoints for `/api/admin/orders`
-   Read/update endpoints for `/api/admin/customers` when customer
    management is implemented
-   CRUD endpoints for `/api/admin/discounts`
-   Read/update endpoints for `/api/admin/settings`
-   `GET /api/admin/dashboard/stats`

All write endpoints require server-side authentication and authorization
as appropriate. Validate request bodies and route parameters. Do not
expose stack traces, password hashes, session secrets, or internal error
details to clients.

## 9. Design Requirements

### Storefront visual direction

-   Modern, clean, editorial fashion aesthetic.
-   Neutral colors such as black, white, warm gray, and a restrained
    accent color.
-   Strong typography and generous spacing.
-   Responsive product grid.
-   Consistent product-card proportions.
-   Clear loading, empty, error, and success states.
-   Accessible labels, visible keyboard focus, and sufficient contrast.

### Admin visual direction

-   Separate dashboard layout with sidebar navigation and top bar.
-   Compact data tables with search and filters.
-   Clear forms for create/edit actions.
-   Confirmation dialog before destructive actions.
-   Toasts or inline messages for success and failure.
-   Responsive layout that remains usable on smaller screens.
-   No dependency on the public storefront header.

Avoid excessive animation, large video backgrounds, and heavy UI
libraries.

## 10. Images and Asset Policy

Keep assets small and legally reusable.

-   Use a small number of optimized local images or simple placeholders.
-   Prefer compressed WebP or similarly efficient formats where
    supported.
-   Resize images to the dimensions actually needed by the interface.
-   Do not download a large image library.
-   Do not bundle videos, raw design files, or unused assets.
-   If external image URLs are used, provide local placeholders so the
    store remains usable when those URLs fail.
-   Admins should be able to change a product image by choosing a
    supported image file or editing a valid image URL, depending on the
    chosen implementation.
-   If uploads are implemented, restrict file types, file sizes, and
    filenames; validate files server-side and store them in a controlled
    directory. Do not accept arbitrary executable files.

## 11. Performance and Submission Size

The source-code ZIP sent to the instructor must be **less than 10 MB**.

To meet this target:

-   Exclude `node_modules/`.
-   Exclude frontend build output such as `client/dist/`.
-   Exclude caches, logs, temporary files, editor folders, and
    operating-system metadata.
-   Exclude real `.env` files, database files containing private data,
    and uploaded user content.
-   Include `package.json` and lockfiles so dependencies can be
    installed reproducibly.
-   Include only a small set of optimized demo images.
-   Use `.gitignore` and provide an explicit list of excluded paths in
    the README.
-   Check the actual ZIP size before submission; do not claim compliance
    without measuring it.

The project must be reproducible using documented install and database
initialization commands. The instructor should not need the developer's
existing `node_modules` folder.

Example `.gitignore` entries:

``` gitignore
node_modules/
client/dist/
.env
server/.env
*.log
.DS_Store
Thumbs.db
coverage/
.vscode/
.idea/
```

Do not ignore source files, lockfiles, migrations, or the README.

## 12. Security and Data Integrity

-   Hash passwords; never store plain-text passwords.
-   Keep secrets in environment variables.
-   Validate all user input on the server.
-   Use parameterized SQL queries.
-   Protect state-changing admin endpoints against cross-site request
    forgery when using cookie-based sessions.
-   Configure CORS narrowly if frontend and backend use different
    origins.
-   Apply basic request-body size limits and login rate limiting.
-   Recalculate order totals on the server.
-   Prevent ordering more stock than is available.
-   Use database transactions for order creation, stock deduction, and
    cancellation/stock restoration.
-   Ensure stock is not restored more than once.
-   Do not let public endpoints read or modify admin data.
-   Do not expose sensitive customer information unnecessarily.
-   Use generic authentication errors that do not reveal whether an
    email exists.
-   Provide a safe demo seed process and do not include production
    credentials.

## 13. Seed Data

Provide a repeatable seed command that creates:

-   A small set of categories (for example, Tops, Bottoms, Outerwear,
    and Accessories).
-   Approximately 8--12 sample products with varied prices, sizes,
    colors, and stock.
-   A few discount codes for testing, including at least one inactive or
    expired example if practical.
-   Store settings.
-   An initial administrator created securely through environment
    variables or a local setup flow.

Seed data should be fictional. Do not use real customer information. The
seed process should be safe to rerun or should clearly explain how to
reset the local demo database.

## 14. Testing and Acceptance Criteria

The MVP is considered complete when all of the following are verified:

### Storefront

-   [ ] The home page and product catalog load without errors.
-   [ ] Search, category filtering, sorting, and product details work.
-   [ ] The cart can add, update, and remove items.
-   [ ] Out-of-stock variants cannot be purchased.
-   [ ] Checkout validates required customer and address fields.
-   [ ] The server calculates totals and validates stock.
-   [ ] A successful simulated checkout creates an order visible in the
    admin area.
-   [ ] The UI clearly states that payment is simulated.

### Admin access

-   [ ] No admin button or admin link appears anywhere in the public
    storefront navigation or footer.
-   [ ] `/admin/login` can be accessed directly.
-   [ ] Unauthenticated access to `/admin` redirects to `/admin/login`.
-   [ ] Successful login opens the separate admin dashboard.
-   [ ] Logout ends the session.
-   [ ] Protected admin API calls fail when the requester is
    unauthenticated.
-   [ ] The admin area has its own layout and navigation.

### Admin functionality

-   [ ] Admins can create, view, edit, activate/deactivate, and safely
    delete or archive products.
-   [ ] Product and category changes persist after a page reload.
-   [ ] Admins can manage categories.
-   [ ] Admins can view order details and update valid order statuses.
-   [ ] Cancelling an order restores stock exactly once when applicable.
-   [ ] Admins can manage discount codes.
-   [ ] Admins can update store settings.
-   [ ] Dashboard metrics reflect database data.
-   [ ] Invalid inputs show useful error messages.
-   [ ] Destructive actions require confirmation.

### Quality and delivery

-   [ ] Database initialization and seed commands work from a clean
    setup.
-   [ ] README instructions work on a fresh install.
-   [ ] No real secrets or credentials are included.
-   [ ] Core API validation and authorization tests pass.
-   [ ] The submission ZIP is measured and is below 10 MB.
-   [ ] The application works at desktop and mobile viewport sizes.

## 15. README Requirements

The README must be written in English and include:

1.  Project overview and feature list.
2.  Technology stack.
3.  Prerequisites and supported Node.js version.
4.  Installation steps.
5.  Environment-variable setup using `.env.example`.
6.  Database initialization and seed instructions.
7.  How to create or configure the first admin account safely.
8.  Commands to run the frontend and backend in development.
9.  Test commands.
10. Route summary, including `/admin/login` and `/admin`.
11. Security notes explaining simulated payment and demo credentials.
12. Instructions for creating a submission ZIP under 10 MB, including
    what to exclude.

Never publish a default admin password in a public deployment. For a
local classroom demo, document the safe local setup procedure for
creating an admin account.

## 16. Suggested Implementation Milestones

1.  Initialize the repository, frontend, backend, database, and README.
2.  Implement schema creation and fictional seed data.
3.  Build the public storefront and product catalog.
4.  Implement cart and server-validated simulated checkout.
5.  Implement admin authentication and protected `/admin` routes.
6.  Build product and category management.
7.  Build order, inventory, discount, customer, and settings management.
8.  Add validation, error handling, and core tests.
9.  Test a clean install and the full order lifecycle.
10. Optimize assets, create the source ZIP, and verify that it is below
    10 MB.

Build a working MVP first. Do not add optional features until the
required flows work end to end.

## 17. Future Enhancements (Not Required for MVP)

The architecture should allow these features to be added later without
rebuilding the project:

-   Customer accounts and order history.
-   Wishlist.
-   Product reviews and ratings.
-   Real payment gateway integration.
-   Email notifications.
-   Product recommendations.
-   Advanced sales reports.
-   Multiple admin roles and granular permissions.
-   Product image upload management.
-   Localization and multiple currencies.

## Final Delivery Definition

Deliver a working THREADS Fashion Store project with a public
storefront, a separate and protected admin area at `/admin`, a direct
admin login route at `/admin/login`, SQLite persistence,
server-validated simulated checkout, complete core admin CRUD, setup
documentation, and a reproducible source-code ZIP under 10 MB.

The admin area must not be linked from the public storefront. All
administrative permissions must be enforced on the server, not merely
hidden in the user interface.

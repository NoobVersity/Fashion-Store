import { Routes, Route } from 'react-router-dom';

// Storefront
import StorefrontLayout from './components/StorefrontLayout.jsx';
import CustomerAuthProvider from './context/CustomerAuthContext.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderConfirmation from './pages/OrderConfirmation.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import CustomerAccount from './pages/Account.jsx';
import NotFound from './pages/NotFound.jsx';

// Admin (never linked from the storefront)
import AdminAuthProvider from './admin/AdminAuthProvider.jsx';
import AdminRoute from './admin/AdminRoute.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import AdminLogin from './admin/pages/AdminLogin.jsx';
import Dashboard from './admin/pages/Dashboard.jsx';
import Products from './admin/pages/Products.jsx';
import Categories from './admin/pages/Categories.jsx';
import Orders from './admin/pages/Orders.jsx';
import OrderDetail from './admin/pages/OrderDetail.jsx';
import Customers from './admin/pages/Customers.jsx';
import CustomerDetail from './admin/pages/CustomerDetail.jsx';
import Discounts from './admin/pages/Discounts.jsx';
import Inventory from './admin/pages/Inventory.jsx';
import Settings from './admin/pages/Settings.jsx';
import Account from './admin/pages/Account.jsx';
import AdminNotFound from './admin/pages/AdminNotFound.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public storefront */}
      <Route element={<CustomerAuthProvider><StorefrontLayout /></CustomerAuthProvider>}>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/product/:slug" element={<ProductDetails />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account" element={<CustomerAccount />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Admin area — direct URL access only, separate layout */}
      <Route
        path="/admin/login"
        element={
          <AdminAuthProvider>
            <AdminLogin />
          </AdminAuthProvider>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminAuthProvider>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </AdminAuthProvider>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="categories" element={<Categories />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="discounts" element={<Discounts />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="settings" element={<Settings />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}

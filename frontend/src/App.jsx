import React, { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const emptyProduct = { name: "", sku: "", price: "", quantity: "" };
const emptyCustomer = { full_name: "", email: "", phone: "" };

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Something went wrong");
  }
  return response.status === 204 ? null : response.json();
}

function Button({ children, variant = "primary", ...props }) {
  return <button className={`button ${variant}`} {...props}>{children}</button>;
}

function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

function Products({ products, reload, notify }) {
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, price: Number(form.price), quantity: Number(form.quantity) };
    try {
      await api(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      notify(editingId ? "Product updated" : "Product added");
      setForm(emptyProduct);
      setEditingId(null);
      reload();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function remove(id) {
    try {
      await api(`/products/${id}`, { method: "DELETE" });
      notify("Product deleted");
      reload();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  function edit(product) {
    setEditingId(product.id);
    setForm({ name: product.name, sku: product.sku, price: product.price, quantity: product.quantity });
  }

  return (
    <section className="split">
      <div className="card">
        <div className="section-heading">
          <div><p className="eyebrow">Catalog</p><h2>{editingId ? "Update product" : "Add a product"}</h2></div>
          {editingId && <Button variant="ghost" type="button" onClick={() => { setEditingId(null); setForm(emptyProduct); }}>Cancel</Button>}
        </div>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Product name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
          <Field label="SKU / code" required value={form.sku} onChange={(e) => update("sku", e.target.value)} />
          <Field label="Unit price" required min="0.01" step="0.01" type="number" value={form.price} onChange={(e) => update("price", e.target.value)} />
          <Field label="Quantity in stock" required min="0" type="number" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
          <Button type="submit">{editingId ? "Save changes" : "Add product"}</Button>
        </form>
      </div>
      <div className="card table-card">
        <div className="section-heading"><div><p className="eyebrow">Inventory</p><h2>Products</h2></div><span className="count">{products.length}</span></div>
        {products.length === 0 ? <EmptyState>No products yet. Add your first item.</EmptyState> : (
          <div className="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
          <tbody>{products.map((product) => <tr key={product.id}>
            <td><strong>{product.name}</strong><small>{product.sku}</small></td><td>${Number(product.price).toFixed(2)}</td>
            <td><span className={`stock ${product.quantity <= 5 ? "low" : ""}`}>{product.quantity}</span></td>
            <td className="actions"><button onClick={() => edit(product)}>Edit</button><button onClick={() => remove(product.id)}>Delete</button></td>
          </tr>)}</tbody></table></div>
        )}
      </div>
    </section>
  );
}

function Customers({ customers, reload, notify }) {
  const [form, setForm] = useState(emptyCustomer);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    try {
      await api("/customers", { method: "POST", body: JSON.stringify(form) });
      setForm(emptyCustomer);
      notify("Customer added");
      reload();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function remove(id) {
    try {
      await api(`/customers/${id}`, { method: "DELETE" });
      notify("Customer deleted");
      reload();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  return (
    <section className="split">
      <div className="card">
        <p className="eyebrow">Relationships</p><h2>Add a customer</h2>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Full name" required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
          <Field label="Email address" required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          <Field label="Phone number" required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          <Button type="submit">Add customer</Button>
        </form>
      </div>
      <div className="card table-card">
        <div className="section-heading"><div><p className="eyebrow">Directory</p><h2>Customers</h2></div><span className="count">{customers.length}</span></div>
        {customers.length === 0 ? <EmptyState>No customers yet.</EmptyState> : (
          <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Action</th></tr></thead>
          <tbody>{customers.map((customer) => <tr key={customer.id}>
            <td><strong>{customer.full_name}</strong><small>{customer.email}</small></td><td>{customer.phone}</td>
            <td className="actions"><button onClick={() => remove(customer.id)}>Delete</button></td>
          </tr>)}</tbody></table></div>
        )}
      </div>
    </section>
  );
}

function Orders({ orders, products, customers, reload, notify }) {
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: 1 }]);
  const [selected, setSelected] = useState(null);

  function updateItem(index, key, value) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  async function submit(event) {
    event.preventDefault();
    try {
      await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerId),
          items: items.map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity) })),
        }),
      });
      setCustomerId("");
      setItems([{ product_id: "", quantity: 1 }]);
      notify("Order created and inventory updated");
      reload();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function remove(id) {
    try {
      await api(`/orders/${id}`, { method: "DELETE" });
      if (selected?.id === id) setSelected(null);
      notify("Order canceled and stock restored");
      reload();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  return (
    <section className="split">
      <div className="card">
        <p className="eyebrow">Fulfillment</p><h2>Create an order</h2>
        <form className="form-grid" onSubmit={submit}>
          <label className="field"><span>Customer</span><select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}
          </select></label>
          {items.map((item, index) => <div className="order-line" key={index}>
            <label className="field"><span>Product</span><select required value={item.product_id} onChange={(e) => updateItem(index, "product_id", e.target.value)}>
              <option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.quantity} available)</option>)}
            </select></label>
            <Field label="Qty" required min="1" type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} />
            {items.length > 1 && <button className="remove-line" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}
          </div>)}
          <div className="button-row"><Button variant="secondary" type="button" onClick={() => setItems((current) => [...current, { product_id: "", quantity: 1 }])}>Add line</Button><Button type="submit">Create order</Button></div>
        </form>
      </div>
      <div className="card table-card">
        <div className="section-heading"><div><p className="eyebrow">History</p><h2>Orders</h2></div><span className="count">{orders.length}</span></div>
        {orders.length === 0 ? <EmptyState>No orders yet.</EmptyState> : (
          <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Actions</th></tr></thead>
          <tbody>{orders.map((order) => <tr key={order.id}>
            <td><strong>#{order.id}</strong><small>{new Date(order.created_at).toLocaleDateString()}</small></td><td>{order.customer.full_name}</td><td>${Number(order.total_amount).toFixed(2)}</td>
            <td className="actions"><button onClick={() => setSelected(order)}>Details</button><button onClick={() => remove(order.id)}>Cancel</button></td>
          </tr>)}</tbody></table></div>
        )}
        {selected && <div className="order-detail"><div className="section-heading"><h3>Order #{selected.id}</h3><button onClick={() => setSelected(null)}>Close</button></div>
          {selected.items.map((item) => <div className="detail-line" key={item.id}><span>{item.product.name} × {item.quantity}</span><strong>${(Number(item.unit_price) * item.quantity).toFixed(2)}</strong></div>)}
        </div>}
      </div>
    </section>
  );
}

function Dashboard({ products, customers, orders }) {
  const lowStock = products.filter((product) => product.quantity <= 5);
  const stats = [["Products", products.length], ["Customers", customers.length], ["Orders", orders.length], ["Low stock", lowStock.length]];
  return (
    <>
      <section className="stats">{stats.map(([label, value]) => <article className="stat card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="card dashboard-panel"><p className="eyebrow">Stock watch</p><h2>Items that need attention</h2>
        {lowStock.length === 0 ? <EmptyState>Inventory levels look healthy.</EmptyState> : <div className="low-stock-list">{lowStock.map((product) => <div key={product.id}><span>{product.name}<small>{product.sku}</small></span><strong>{product.quantity} left</strong></div>)}</div>}
      </section>
    </>
  );
}

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [nextProducts, nextCustomers, nextOrders] = await Promise.all([api("/products"), api("/customers"), api("/orders")]);
      setProducts(nextProducts);
      setCustomers(nextCustomers);
      setOrders(nextOrders);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function notify(text, type = "success") {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 3500);
  }

  useEffect(() => { load(); }, []);
  const section = useMemo(() => ({
    dashboard: <Dashboard products={products} customers={customers} orders={orders} />,
    products: <Products products={products} reload={load} notify={notify} />,
    customers: <Customers customers={customers} reload={load} notify={notify} />,
    orders: <Orders orders={orders} products={products} customers={customers} reload={load} notify={notify} />,
  }[active]), [active, products, customers, orders]);

  return (
    <main>
      <header>
        <div><p className="eyebrow">Operations console</p><h1>Stockroom</h1></div>
        <nav>{["dashboard", "products", "customers", "orders"].map((item) => <button className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)}>{item}</button>)}</nav>
      </header>
      <div className="page-title"><div><p className="eyebrow">Inventory and orders</p><h2>{active[0].toUpperCase() + active.slice(1)}</h2></div><span className="api-status"><i /> API connected</span></div>
      {message && <div className={`message ${message.type}`}>{message.text}</div>}
      {loading ? <div className="card empty-state">Loading inventory...</div> : section}
      <footer>Stockroom inventory management</footer>
    </main>
  );
}

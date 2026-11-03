const $ = (id) => document.getElementById(id);
const loginScreen = $('login-screen');
const shopScreen = $('shop-screen');
const productsRoot = $('products');
const cartItemsRoot = $('cart-items');
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

let token = '';
let products = [];
const cart = new Map();

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderProducts() {
  productsRoot.replaceChildren();
  const search = $('search').value.trim().toLowerCase();
  const category = $('category').value;
  const visible = products.filter(
    (p) => p.name.toLowerCase().includes(search) && (!category || p.category === category),
  );
  for (const product of visible) {
    const card = document.createElement('article');
    card.className = 'product';
    card.dataset.testid = 'product-card';
    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = product.name;
    const detail = document.createElement('p');
    detail.textContent = `${product.category} · ${money(product.priceCents)}`;
    info.append(title, detail);
    const button = document.createElement('button');
    button.textContent = 'Add to cart';
    button.type = 'button';
    button.addEventListener('click', () => {
      cart.set(product.id, (cart.get(product.id) || 0) + 1);
      $('order-status').textContent = '';
      renderCart();
    });
    card.append(info, button);
    productsRoot.append(card);
  }
  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No matching products';
    productsRoot.append(empty);
  }
}

function renderCart() {
  cartItemsRoot.replaceChildren();
  let count = 0;
  let total = 0;
  for (const [id, quantity] of cart) {
    const product = products.find((p) => p.id === id);
    if (!product) continue;
    count += quantity;
    total += product.priceCents * quantity;
    const item = document.createElement('li');
    item.textContent = `${product.name} × ${quantity}`;
    cartItemsRoot.append(item);
  }
  document.querySelector('[data-testid="cart-count"]').textContent = String(count);
  document.querySelector('[data-testid="cart-total"]').textContent = money(total);
  $('place-order').disabled = count === 0;
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('login-error').hidden = true;
  try {
    const auth = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('email').value, password: $('password').value }),
    });
    token = auth.token;
    products = (await api('/api/products')).products;
    loginScreen.hidden = true;
    shopScreen.hidden = false;
    renderProducts();
    renderCart();
  } catch (error) {
    $('login-error').textContent = error.message;
    $('login-error').hidden = false;
  }
});

$('logout').addEventListener('click', () => {
  token = '';
  cart.clear();
  shopScreen.hidden = true;
  loginScreen.hidden = false;
  $('password').value = '';
  $('order-status').textContent = '';
});
$('search').addEventListener('input', renderProducts);
$('category').addEventListener('change', renderProducts);
$('place-order').addEventListener('click', async () => {
  const items = [...cart].map(([productId, quantity]) => ({ productId, quantity }));
  try {
    const result = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    cart.clear();
    renderCart();
    $('order-status').textContent = `Order confirmed: ${result.id}`;
  } catch (error) {
    $('order-status').textContent = error.message;
  }
});

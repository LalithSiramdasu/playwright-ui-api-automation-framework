/** NORTHLINE GOODS — real UX states integrated into the shopping journey. */
const $ = (id) => document.getElementById(id);
const loginScreen = $('login-screen');
const shopScreen = $('shop-screen');
const productsRoot = $('products');
const cartItemsRoot = $('cart-items');
const loginError = $('login-error');
const orderStatus = $('order-status');
const catalogFeedback = $('catalog-feedback');
const slowNotice = $('slow-notice');
const networkBanner = $('network-banner');
const refreshButton = $('refresh-products');
const confirmation = $('order-confirmation');
const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const money = (paise) => formatter.format(paise / 100);
const cart = new Map();
let token = '';
let products = [];
let orderReference = '';
let catalogLoading = false;

async function api(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof TypeError || !navigator.onLine) {
      const offline = new Error('Connection unavailable. Check your network and try again.');
      offline.status = 0;
      throw offline;
    }
    throw error;
  }
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function syncNetworkBanner() {
  networkBanner.hidden = navigator.onLine;
}

function showCatalogLoading() {
  productsRoot.replaceChildren();
  $('result-count').textContent = 'LOADING COLLECTION';
  for (let i = 0; i < 3; i += 1) {
    const skeleton = textElement('div', 'skeleton-row', '');
    skeleton.setAttribute('aria-hidden', 'true');
    skeleton.append(textElement('div', 'skeleton-media', ''));
    const lines = textElement('div', 'skeleton-lines', '');
    lines.append(textElement('span', '', ''), textElement('span', '', ''));
    skeleton.append(lines);
    productsRoot.append(skeleton);
  }
}

function resetFilters() {
  $('search').value = '';
  $('category').value = '';
  renderProducts();
}

function renderProducts() {
  productsRoot.replaceChildren();
  const search = $('search').value.trim().toLowerCase();
  const category = $('category').value;
  const visible = products.filter(
    (product) => product.name.toLowerCase().includes(search) && (!category || product.category === category),
  );
  $('result-count').textContent = `${String(visible.length).padStart(2, '0')} PIECE${visible.length === 1 ? '' : 'S'} IN VIEW`;

  for (const product of visible) {
    const article = textElement('article', 'product', '');
    article.dataset.testid = 'product-card';
    const visualName = { 101: 'mouse', 102: 'notebook', 103: 'bottle' }[product.id] || 'mouse';
    const art = textElement('figure', `product-art product-art--${visualName}`, '');
    art.dataset.index = String(product.id - 100);
    art.setAttribute('aria-hidden', 'true');
    art.append(textElement('span', 'object', ''));
    const info = textElement('div', 'product-info', '');
    info.append(textElement('p', 'product-meta', `${product.category.toUpperCase()} / OBJECT ${String(product.id - 100).padStart(2, '0')}`));
    info.append(textElement('h4', '', product.name));
    const detail = { 101: 'A quieter way to work.', 102: 'A place for the next idea.', 103: 'Made for the everyday carry.' }[product.id] || 'A considered essential.';
    info.append(textElement('p', 'product-details', detail));
    const bottom = textElement('div', 'product-bottom', '');
    bottom.append(textElement('strong', 'product-price', money(product.pricePaise)));
    const addButton = textElement('button', 'add-to-cart', 'Add to cart');
    addButton.type = 'button';
    addButton.addEventListener('click', () => {
      cart.set(product.id, (cart.get(product.id) || 0) + 1);
      orderStatus.textContent = '';
      orderStatus.classList.remove('is-error');
      confirmation.hidden = true;
      $('copy-feedback').textContent = '';
      $('reference-fallback').hidden = true;
      renderCart();
    });
    bottom.append(addButton);
    info.append(bottom);
    article.append(art, info);
    productsRoot.append(article);
  }

  if (visible.length === 0) {
    const empty = textElement('div', 'catalog-empty', '');
    empty.append(textElement('span', 'catalog-empty-icon', ''));
    empty.append(textElement('h4', '', 'No matching products'));
    empty.append(textElement('p', '', 'Try a different search or explore the complete collection.'));
    const reset = textElement('button', 'link-button', 'Clear filters');
    reset.type = 'button';
    reset.addEventListener('click', resetFilters);
    empty.append(reset);
    productsRoot.append(empty);
  }
}

function renderCart() {
  cartItemsRoot.replaceChildren();
  let count = 0;
  let total = 0;
  for (const [id, quantity] of cart) {
    const product = products.find((entry) => entry.id === id);
    if (!product) continue;
    count += quantity;
    total += product.pricePaise * quantity;
    const item = textElement('li', '', '');
    item.append(textElement('span', '', `${product.name} × ${quantity}`));
    item.append(textElement('strong', '', money(product.pricePaise * quantity)));
    cartItemsRoot.append(item);
  }
  document.querySelector('[data-testid="cart-count"]').textContent = String(count);
  document.querySelector('[data-testid="cart-total"]').textContent = money(total);
  $('cart-empty').hidden = count !== 0;
  $('place-order').disabled = count === 0;
}

function showCatalogError(error) {
  productsRoot.replaceChildren();
  $('result-count').textContent = 'COLLECTION UNAVAILABLE';
  catalogFeedback.replaceChildren();
  catalogFeedback.hidden = false;
  const heading = textElement('strong', '', error.status === 0 ? 'You appear to be offline.' : 'The collection could not be loaded.');
  const explanation = textElement('p', '', 'Your cart and filters have been kept. Try loading the products again.');
  const retry = textElement('button', 'retry-button', 'Retry loading products');
  retry.type = 'button';
  retry.addEventListener('click', loadCatalog);
  catalogFeedback.append(heading, explanation, retry);
  syncNetworkBanner();
}

async function loadCatalog() {
  if (catalogLoading) return;
  catalogLoading = true;
  refreshButton.disabled = true;
  slowNotice.hidden = true;
  catalogFeedback.hidden = true;
  showCatalogLoading();
  // Only show a slow-connection message after a genuinely delayed response.
  const slowTimer = setTimeout(() => { slowNotice.hidden = false; }, 700);
  try {
    products = (await api('/api/products')).products;
    renderProducts();
    renderCart();
  } catch (error) {
    showCatalogError(error);
  } finally {
    clearTimeout(slowTimer);
    slowNotice.hidden = true;
    refreshButton.disabled = false;
    catalogLoading = false;
  }
}

function signOut(reason = '', preserveCart = false) {
  token = '';
  if (!preserveCart) cart.clear();
  products = [];
  shopScreen.hidden = true;
  loginScreen.hidden = false;
  $('password').value = '';
  orderStatus.textContent = '';
  confirmation.hidden = true;
  loginError.hidden = !reason;
  loginError.textContent = reason;
}

function updateFieldValidity(field) {
  const message = $(`${field.id}-field-error`);
  let feedback = '';
  if (field.validity.valueMissing) feedback = `${field.id === 'email' ? 'Email address' : 'Password'} is required.`;
  else if (field.validity.typeMismatch) feedback = 'Enter a complete email address.';
  message.textContent = feedback;
  message.hidden = !feedback;
  field.setAttribute('aria-invalid', String(Boolean(feedback)));
}

for (const id of ['email', 'password']) {
  const field = $(id);
  field.addEventListener('invalid', () => updateFieldValidity(field));
  field.addEventListener('input', () => {
    updateFieldValidity(field);
    loginError.hidden = true;
  });
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const submit = $('sign-in-button');
  submit.disabled = true;
  submit.firstChild.textContent = 'Signing in ';
  try {
    const auth = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('email').value, password: $('password').value }),
    });
    token = auth.token;
    loginScreen.hidden = true;
    shopScreen.hidden = false;
    await loadCatalog();
  } catch (error) {
    token = '';
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    submit.disabled = false;
    submit.firstChild.textContent = 'Sign in ';
  }
});

$('logout').addEventListener('click', () => signOut());
$('browse-catalog').addEventListener('click', () => $('search').focus());
$('search').addEventListener('input', () => { if (!catalogLoading && catalogFeedback.hidden) renderProducts(); });
$('category').addEventListener('change', () => { if (!catalogLoading && catalogFeedback.hidden) renderProducts(); });
refreshButton.addEventListener('click', loadCatalog);
$('retry-connection').addEventListener('click', () => {
  syncNetworkBanner();
  if (navigator.onLine && !shopScreen.hidden) loadCatalog();
});
window.addEventListener('online', syncNetworkBanner);
window.addEventListener('offline', syncNetworkBanner);
syncNetworkBanner();

$('place-order').addEventListener('click', async () => {
  const button = $('place-order');
  const items = [...cart].map(([productId, quantity]) => ({ productId, quantity }));
  if (!items.length) return;
  button.disabled = true;
  button.firstChild.textContent = 'Placing order ';
  orderStatus.classList.remove('is-error');
  orderStatus.textContent = 'Processing your order…';
  confirmation.hidden = true;
  const slowTimer = setTimeout(() => { orderStatus.textContent = 'Still processing. Please do not submit again.'; }, 700);
  try {
    const result = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items }) });
    cart.clear();
    renderCart();
    orderReference = result.id;
    $('order-reference').textContent = orderReference;
    $('copy-feedback').textContent = '';
    $('reference-fallback').hidden = true;
    confirmation.hidden = false;
    orderStatus.textContent = `Order confirmed: ${result.id}`;
  } catch (error) {
    if (error.status === 401) {
      signOut('Your session expired. Sign in again to continue.', true);
      return;
    }
    orderStatus.classList.add('is-error');
    orderStatus.textContent = `Could not place order. ${error.message}`;
  } finally {
    clearTimeout(slowTimer);
    button.firstChild.textContent = 'Place order ';
    button.disabled = cart.size === 0;
  }
});

$('copy-reference').addEventListener('click', async () => {
  if (!orderReference) return;
  const feedback = $('copy-feedback');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(orderReference);
    feedback.textContent = 'Reference copied to clipboard.';
    $('reference-fallback').hidden = true;
  } catch {
    feedback.textContent = 'Clipboard permission unavailable. Select and copy the reference below.';
    const fallback = $('reference-fallback');
    fallback.value = orderReference;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
  }
});

/** GOOD FORM: a small, intentionally deterministic storefront for UI/API automation. */
const $ = (id) => document.getElementById(id);
const loginScreen = $('login-screen');
const shopScreen = $('shop-screen');
const productsRoot = $('products');
const cartItemsRoot = $('cart-items');
const shopContent = $('shop-content');
const statesContent = $('states-content');
const stateOptions = $('state-options');
const statePreview = $('state-preview');
const loginError = $('login-error');
const orderStatus = $('order-status');
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const cart = new Map();
let token = '';
let products = [];

const scenarios = [
  { id: 'empty', label: 'Empty state', eyebrow: '01 / EMPTY', glyph: '○', title: 'Nothing here. Yet.', detail: 'An empty bag should offer direction instead of leaving someone at a dead end.', action: 'Browse the collection', note: 'A real empty cart is also available in the shop.' },
  { id: 'loading', label: 'Loading state', eyebrow: '02 / LOADING', glyph: '◌', title: 'Curating your collection.', detail: 'Content-shaped placeholders communicate progress without shifting the layout.', action: 'Return to collection', note: 'The storefront also handles actual request loading.' },
  { id: 'error', label: 'Error state', eyebrow: '03 / REQUEST FAILED', glyph: '!', title: 'This request didn’t complete.', detail: 'We couldn’t load the latest products. Your selection has not been changed.', action: 'Retry catalog request', note: 'Checkout failures also receive a specific inline message.' },
  { id: 'offline', label: 'No internet', eyebrow: '04 / CONNECTION LOST', glyph: '⌁', title: 'You appear to be offline.', detail: 'Check your connection and try again. Your local cart will remain as it is.', action: 'Check connection', note: 'This preview simulates offline; real network errors are handled separately.' },
  { id: 'slow', label: 'Slow network', eyebrow: '05 / SLOW NETWORK', glyph: '↗', title: 'Still working on it.', detail: 'A slower response deserves honest progress and reassurance, not an endless spinner.', action: 'Continue browsing', note: 'The progress indicator illustrates a delayed request.' },
  { id: 'no-results', label: 'No search results', eyebrow: '06 / NO RESULTS', glyph: '⌕', title: 'No matches this time.', detail: 'Try a shorter search or remove the category filter to see the full collection.', action: 'Clear filters', note: 'Search “does-not-exist” in the shop for the real state.' },
  { id: 'permission', label: 'Permission denied', eyebrow: '07 / CAMERA BLOCKED', glyph: '⊘', title: 'Camera access is off.', detail: 'Your browser has not granted camera access. You can continue without it using a file instead.', action: 'Choose a file instead', note: 'This is a controlled permission-denied fixture.' },
  { id: 'session', label: 'Session expired', eyebrow: '08 / SESSION EXPIRED', glyph: '↻', title: 'Time to sign in again.', detail: 'Your session ended to keep the account safe. Sign in to pick up where you left off.', action: 'Sign in again', note: 'The app also handles a real unauthorized checkout response.' },
  { id: 'validation', label: 'Form validation', eyebrow: '09 / VALIDATION', glyph: '!', title: 'One detail needs attention.', detail: 'Explain exactly which field needs changing, then keep the rest of the form intact.', action: 'Review sign-in form', note: 'Real sign-in fields use required and email validation.' },
  { id: 'success', label: 'Success state', eyebrow: '10 / COMPLETE', glyph: '✓', title: 'Order confirmed.', detail: 'Give clear confirmation and an obvious next step when an action finishes successfully.', action: 'Continue shopping', note: 'Complete a real checkout to get an order reference.' },
];

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
      const offline = new Error('You seem to be offline. Check your connection and try again.');
      offline.status = 0;
      throw offline;
    }
    throw error;
  }
}

function textElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function showCatalogLoading() {
  productsRoot.replaceChildren();
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

function renderProducts() {
  productsRoot.replaceChildren();
  const search = $('search').value.trim().toLowerCase();
  const category = $('category').value;
  const visible = products.filter(
    (product) => product.name.toLowerCase().includes(search) && (!category || product.category === category),
  );
  $('result-count').textContent = `${String(visible.length).padStart(2, '0')} PIECE${visible.length === 1 ? '' : 'S'} IN VIEW`;

  visible.forEach((product) => {
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
    bottom.append(textElement('strong', 'product-price', money(product.priceCents)));
    const addButton = textElement('button', 'add-to-cart', 'Add to cart');
    addButton.type = 'button';
    addButton.addEventListener('click', () => {
      cart.set(product.id, (cart.get(product.id) || 0) + 1);
      orderStatus.textContent = '';
      orderStatus.classList.remove('is-error');
      renderCart();
    });
    bottom.append(addButton);
    info.append(bottom);
    article.append(art, info);
    productsRoot.append(article);
  });

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
    total += product.priceCents * quantity;
    const item = textElement('li', '', '');
    item.append(textElement('span', '', `${product.name} × ${quantity}`));
    item.append(textElement('strong', '', money(product.priceCents * quantity)));
    cartItemsRoot.append(item);
  }
  document.querySelector('[data-testid="cart-count"]').textContent = String(count);
  document.querySelector('[data-testid="cart-total"]').textContent = money(total);
  $('cart-empty').hidden = count !== 0;
  $('place-order').disabled = count === 0;
}

function resetFilters() {
  $('search').value = '';
  $('category').value = '';
  renderProducts();
}

function showSection(which) {
  const lab = which === 'states';
  shopContent.hidden = lab;
  statesContent.hidden = !lab;
  $('nav-shop').classList.toggle('is-active', !lab);
  $('nav-states').classList.toggle('is-active', lab);
  $('nav-shop').setAttribute('aria-pressed', String(!lab));
  $('nav-states').setAttribute('aria-pressed', String(lab));
}

function signOut(reason = '') {
  token = '';
  cart.clear();
  products = [];
  shopScreen.hidden = true;
  loginScreen.hidden = false;
  $('password').value = '';
  orderStatus.textContent = '';
  showSection('shop');
  loginError.hidden = !reason;
  loginError.textContent = reason;
}

function createSpecimen(id) {
  const spec = scenarios.find((item) => item.id === id);
  if (!spec) return;
  statePreview.replaceChildren();
  const view = textElement('section', 'state-view', '');
  view.dataset.testid = 'state-view';
  view.dataset.state = spec.id;
  view.append(textElement('div', 'state-glyph', spec.glyph));
  view.append(textElement('span', 'state-index', spec.eyebrow));
  view.append(textElement('h4', '', spec.title));
  view.append(textElement('p', '', spec.detail));

  if (id === 'loading') {
    const skeleton = textElement('div', 'skeleton-row', '');
    skeleton.setAttribute('aria-label', 'Loading placeholder');
    skeleton.append(textElement('div', 'skeleton-media', ''));
    const lines = textElement('div', 'skeleton-lines', '');
    lines.append(textElement('span', '', ''), textElement('span', '', ''));
    skeleton.append(lines);
    view.append(skeleton);
  }
  if (id === 'slow') {
    const progress = textElement('div', 'progress-track', '');
    const fill = textElement('div', 'progress-fill', '');
    progress.append(fill);
    progress.setAttribute('aria-label', 'Simulated slow connection progress');
    view.append(progress);
  }
  if (id === 'validation') {
    const sample = textElement('div', 'validation-sample', 'Email address: name@');
    sample.append(textElement('span', '', 'Enter a complete email address.'));
    view.append(sample);
  }
  const action = textElement('button', `state-action${id === 'error' ? ' state-error-action' : ''}`, spec.action);
  action.type = 'button';
  action.addEventListener('click', async () => {
    if (id === 'session' || id === 'validation') {
      signOut(id === 'session' ? 'Your session expired. Sign in again to continue.' : 'Review your email address and password.');
      $('email').focus();
    } else if (id === 'permission') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', () => {
        if (input.files?.length) {
          view.querySelector('.state-support').textContent = `File selected: ${input.files[0].name}. No file is uploaded.`;
        }
      });
      input.click();
    } else if (id === 'offline' && !navigator.onLine) {
      view.querySelector('.state-support').textContent = 'Still offline. Reconnect and try again.';
    } else if (id === 'error') {
      showSection('shop');
      showCatalogLoading();
      try {
        products = (await api('/api/products')).products;
        renderProducts();
        renderCart();
      } catch {
        productsRoot.replaceChildren(textElement('p', 'form-error', 'Could not load products. Check your connection and retry.'));
      }
    } else {
      if (id === 'no-results') resetFilters();
      showSection('shop');
    }
  });
  view.append(action);
  view.append(textElement('small', 'state-support', spec.note));
  statePreview.append(view);
  stateOptions.querySelectorAll('button').forEach((button) => {
    const selected = button.dataset.scenario === id;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function initScenarios() {
  scenarios.forEach((spec, index) => {
    const button = textElement('button', 'state-option', '');
    button.type = 'button';
    button.dataset.scenario = spec.id;
    button.setAttribute('aria-label', spec.label);
    button.setAttribute('aria-pressed', 'false');
    button.append(textElement('span', '', String(index + 1).padStart(2, '0')));
    button.append(document.createTextNode(spec.label));
    button.addEventListener('click', () => createSpecimen(spec.id));
    stateOptions.append(button);
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
    products = (await api('/api/products')).products;
    loginScreen.hidden = true;
    shopScreen.hidden = false;
    showSection('shop');
    renderProducts();
    renderCart();
  } catch (error) {
    token = '';
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    submit.disabled = false;
    submit.firstChild.textContent = 'Sign in ';
  }
});

$('email').addEventListener('input', () => { loginError.hidden = true; });
$('password').addEventListener('input', () => { loginError.hidden = true; });
$('logout').addEventListener('click', () => signOut());
$('nav-shop').addEventListener('click', () => showSection('shop'));
$('nav-states').addEventListener('click', () => showSection('states'));
$('browse-catalog').addEventListener('click', () => $('search').focus());
$('search').addEventListener('input', renderProducts);
$('category').addEventListener('change', renderProducts);

$('place-order').addEventListener('click', async () => {
  const button = $('place-order');
  const items = [...cart].map(([productId, quantity]) => ({ productId, quantity }));
  button.disabled = true;
  button.firstChild.textContent = 'Placing order ';
  try {
    const result = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items }) });
    cart.clear();
    renderCart();
    orderStatus.classList.remove('is-error');
    orderStatus.textContent = `Order confirmed: ${result.id}`;
  } catch (error) {
    if (error.status === 401) {
      signOut('Your session expired. Sign in again to continue.');
      return;
    }
    orderStatus.classList.add('is-error');
    orderStatus.textContent = `Could not place order. ${error.message}`;
  } finally {
    button.firstChild.textContent = 'Place order ';
    button.disabled = cart.size === 0;
  }
});

initScenarios();

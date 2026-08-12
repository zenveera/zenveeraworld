// const auth = firebase.auth();
// const db = firebase.firestore();

const ordersContainer = document.getElementById('ordersContainer');
const searchInput = document.getElementById('orderSearch');

let allOrders = [];
let currentFilter = 'all';

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'admin.html';
    return;
  }

  loadOrders();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = 'admin.html';
});

async function loadOrders() {
  const snapshot = await db.collection('orders')
    .orderBy('createdAt', 'desc')
    .get();

  const now = new Date();

  allOrders = snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter(order => {
      if (!order.createdAt || !order.createdAt.toDate) return true;

      const created = order.createdAt.toDate();
      const diffHours = (now - created) / (1000 * 60 * 60);

      // Hide cancelled orders from the dashboard after 24 hours
      if (order.status === 'cancelled' && diffHours > 24) {
        return false;
      }

      // Hide completed orders from the dashboard after 48 hours
      if (order.status === 'completed' && diffHours > 48) {
        return false;
      }

      return true;
    });

  applyFilter();
}

// Applies both the active status filter (All / Pending / Completed /
// Cancelled) and the search box text together, then renders the result.
function applyFilter() {
  const q = searchInput.value.toLowerCase();

  let filtered = allOrders;

  if (currentFilter !== 'all') {
    filtered = filtered.filter(o => o.status === currentFilter);
  }

  if (q) {
    filtered = filtered.filter(o =>
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.orderId || '').toLowerCase().includes(q)
    );
  }

  renderOrders(filtered);
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersContainer.innerHTML = '<p class="orders-empty">No orders found.</p>';
    updateCounts([]);
    return;
  }

  updateCounts(orders);

  ordersContainer.innerHTML = orders.map(order => {
    const itemsHtml = (order.items || []).map(item =>
      `<li>${item.name} × ${item.qty}</li>`
    ).join('');

    const address = order.address || {};

    return `
      
  <div class="order-card">

    <div class="order-top">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <h3 style="margin:0;">${order.orderId}</h3>
          <button class="btn-status pending-btn"
                  style="padding:4px 8px;font-size:11px;"
                  onclick="copyOrderId('${order.orderId}')">
            Copy ID
          </button>
        </div>
        <p>${formatDate(order.createdAt)}</p>
      </div>

      <span class="status ${order.status}">${capitalize(order.status)}</span>
    </div>

    <div class="order-section">
      <p><strong>👤 ${order.customerName}</strong></p>
      <p>📞 ${order.phone}</p>
    </div>

    <div class="order-section">
      <strong>📍 Delivery Address</strong>
      <p>${address.house || '-'}</p>
      <p>${address.street || '-'}</p>
      <p>${address.area || '-'} ${address.pincode || ''}</p>
      ${address.landmark ? `<p>Landmark: ${address.landmark}</p>` : ''}
    </div>

    <div class="order-section">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>📦 Items</strong>
        <span style="font-size:13px;color:#64748b;">${(order.items || []).length} item(s)</span>
      </div>
      <ul class="order-items">${itemsHtml}</ul>
    </div>

    <div class="order-total">
      Total: ₹${order.total}
    </div>

    <div class="order-actions">

      <button class="btn-status pending-btn"
              onclick="updateStatus('${order.id}','pending')">
        Pending
      </button>

      <button class="btn-status complete-btn"
              onclick="updateStatus('${order.id}','completed')">
        Completed
      </button>

      <button class="btn-status cancel-btn"
              onclick="updateStatus('${order.id}','cancelled')">
        Cancel
      </button>

      <a class="btn-action whatsapp-btn"
         href="https://wa.me/91${order.phone}?text=Hello%20${encodeURIComponent(order.customerName)},%20regarding%20your%20order%20${encodeURIComponent(order.orderId)}%20from%20Zenveera%20World."
         target="_blank">
         WhatsApp
      </a>

      <a class="btn-action call-btn"
         href="tel:+91${order.phone}">
         Call
      </a>

    </div>

  </div>
    `;
  }).join('');
}

async function updateStatus(id, status) {

  const ok = confirm(`Change order status to "${capitalize(status)}"?`);

  if (!ok) return;

  await db.collection('orders').doc(id).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  loadOrders();
}

searchInput.addEventListener('input', () => {
  applyFilter();
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn')
      .forEach(b => b.classList.remove('active'));

    btn.classList.add('active');

    currentFilter = btn.dataset.filter;

    applyFilter();
  });
});

function updateCounts(orders) {
  document.getElementById('pendingCount').textContent =
    orders.filter(o => o.status === 'pending').length;

  document.getElementById('completedCount').textContent =
    orders.filter(o => o.status === 'completed').length;

  document.getElementById('cancelledCount').textContent =
    orders.filter(o => o.status === 'cancelled').length;
}

function capitalize(text='') {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(ts) {
  if (!ts || !ts.toDate) return '';

  return ts.toDate().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}
setInterval(loadOrders, 30000);

(function () {
  "use strict";

  /* ==========================================================
     1. WHATSAPP MESSAGE BUILDERS
  ========================================================== */
  function waLink(product) {
    const message = `🛍️ ${SITE_CONFIG.shopName}

📦 Product:
${product.name}

💰 Price:
₹${product.price}

🖼️ Product Image:
${product.imageUrl || ""}

Hello,
I would like to order this product.
Please let me know if it is available.`;

    return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function genericWaLink(message) {
    return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  /* ==========================================================
     2. APPLY SITE CONFIG TEXT EVERYWHERE
  ========================================================== */
  document.title = SITE_CONFIG.shopName + " — Catalog";

  const footer = document.getElementById("footerShopName");
  if (footer) {
    footer.textContent =
      "© " + new Date().getFullYear() + " " + SITE_CONFIG.shopName;
  }

  const wholesaleBannerNote = document.getElementById("wholesaleBannerNote");
  if (wholesaleBannerNote) {
    wholesaleBannerNote.textContent = SITE_CONFIG.wholesaleText;
  }

  const wholesaleWaBtn = document.getElementById("wholesaleWaBtn");
  if (wholesaleWaBtn) {
    wholesaleWaBtn.href = genericWaLink(
      `🛍️ ${SITE_CONFIG.shopName}\n\nHi, I'd like to ask about wholesale / bulk pricing.`,
    );
  }

  const footerAddress = document.getElementById("footerAddress");
  if (footerAddress) {
    footerAddress.textContent = SITE_CONFIG.shopAddress;
  }

  const waHeaderLink = document.getElementById("waHeaderLink");
  if (waHeaderLink) {
    waHeaderLink.href = genericWaLink(
      `Hi, I'm interested in ${SITE_CONFIG.shopName}.`,
    );
  }

  const instaEl = document.getElementById("instaFooterLink");
  if (instaEl) {
    instaEl.href = SITE_CONFIG.instagramUrl;
  }

  const waFab = document.getElementById("waFab");
  if (waFab) {
    waFab.href = genericWaLink(
      `Hi, I'm interested in ${SITE_CONFIG.shopName}.`,
    );
  }

  /* ==========================================================
     3. CART STATE (stored in the browser — no login required)
  ========================================================== */
  const GUEST_KEY = "zenveera_guest_v1";

  // Cart lives ONLY in Firestore (per logged-in user). This array is just
  // an in-memory mirror of whatever loadUserCart() last fetched.
  let cart = [];
  let pendingCart=null;
  function loadGuest() {
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      return raw ? JSON.parse(raw) : { name: "", phone: "" };
    } catch (e) {
      return { name: "", phone: "" };
    }
  }

  function saveGuest(guest) {
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
    } catch (e) {}
  }

  function cartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function cartTotalAmount() {
    return cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  }

  function findCartItem(cartId) {
    return cart.find((item) => item.cartId === cartId);
  }

  async function addToCart(product, qty = 1, color = null) {
    if (!currentUser) {

    pendingCart = {
      product,
      qty,
      color,
    };

    openAuthModal();
    return false;
  }

    try {
      // const cartRef = db
      //   .collection("users")
      //   .doc(currentUser.uid)
      //   .collection("cart")
      //   .doc(product.id);
      const cartDocId = color ? `${product.id}_${color}` : product.id;

      const cartRef = db
        .collection("users")
        .doc(currentUser.uid)
        .collection("cart")
        .doc(cartDocId);

      const snap = await cartRef.get();

      if (snap.exists) {
        const oldQty = snap.data().qty || 0;

        await cartRef.update({
          qty: oldQty + qty,
        });
      } else {
        // const doc = {
        //   id: product.id,
        //   name: product.name,
        //   price: product.price,
        //   imageUrl: product.imageUrl,
        //   qty: qty,
        //   addedAt: firebase.firestore.FieldValue.serverTimestamp(),
        // };
        let selectedImage = product.imageUrl;

        if (color && product.colors?.length) {
          const selectedColor = product.colors.find((c) => c.name === color);

          if (selectedColor?.imageUrl) {
            selectedImage = selectedColor.imageUrl;
          }
        }

        const data = {
          id: product.id, // Original product ID
          cartId: cartDocId, // <-- Add this line
          name: product.name,
          price: product.price,
          imageUrl: selectedImage,
          color: color || null,
          qty: qty,
          category: product.category,
          addedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

await cartRef.set(data);
      }

      await loadUserCart(); // refresh header badge + drawer right away
return true;
      // alert("Product Added Successfully");
    } catch (err) {
      console.error(err);

      alert(err.message);
       return false;
    }
  }

  async function setCartQty(cartId, qty) {
    if (!currentUser) return;

    const ref = db
      .collection("users")
      .doc(currentUser.uid)
      .collection("cart")
      .doc(cartId);

    if (qty <= 0) {
      await ref.delete();
    } else {
      await ref.update({
        qty: qty,
      });
    }

    await loadUserCart();
  }

 async function removeFromCart(cartId) {
    if (!currentUser) return;

    await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("cart")
      .doc(cartId)
      .delete();

    await loadUserCart();
  }

  // Deletes every item in the logged-in customer's Firestore cart (called
  // right after an order is placed) and refreshes the local cart/UI.
  async function clearCart() {
    if (!currentUser) return;

    try {
      const snapshot = await db
        .collection("users")
        .doc(currentUser.uid)
        .collection("cart")
        .get();

      const batch = db.batch();
      snapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch (err) {
      console.error("Couldn't clear cart:", err);
    }

    await loadUserCart();
  }

  /* ==========================================================
     3b. STATE
  ========================================================== */
  let allProducts = [];
  let currentFilter = "all"; // "all" | "in-stock"
  let currentCategory = "all";
  let newOnly = false;
  let searchText = "";

  const PAGE_SIZE = 12;
  let visibleCount = PAGE_SIZE;

  const grid = document.getElementById("productGrid");
  const emptyState = document.getElementById("emptyState");
  const catalogIntro = document.getElementById("catalogIntro");
  // const loadMoreBtn = document.getElementById("loadMoreBtn");

  function money(n) {
    const num = Number(n);
    if (isNaN(num)) return n;
    return "₹" + num.toLocaleString("en-IN");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // A product counts as "New" if it was added within the last 14 days.
  // function isNewProduct(p) {
  //   if (!p.createdAt || typeof p.createdAt.toDate !== "function") return false;
  //   const ageDays = (Date.now() - p.createdAt.toDate().getTime()) / 86400000;
  //   return ageDays <= 14;
  // }
  function isNewProduct(p) {
    if (!p.createdAt || typeof p.createdAt.toDate !== "function") {
      return false;
    }

    const createdTime = p.createdAt.toDate().getTime();
    const hoursPassed = (Date.now() - createdTime) / (1000 * 60 * 60);

    return hoursPassed <= 48;
  }

  function resetPaging() {
    visibleCount = PAGE_SIZE;
  }

  /* ==========================================================
     3c. CART UI (badge, drawer, mobile sticky bar)
  ========================================================== */
  const cartBtn = document.getElementById("cartBtn");
  const cartBadge = document.getElementById("cartBadge");
  const cartOverlay = document.getElementById("cartOverlay");
  const cartCloseBtn = document.getElementById("cartCloseBtn");
  const cartItemsEl = document.getElementById("cartItems");
  const cartEmptyEl = document.getElementById("cartEmpty");
  const cartFooterEl = document.getElementById("cartFooter");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartEmptyBrowseBtn = document.getElementById("cartEmptyBrowseBtn");
  const cartCheckoutBtn = document.getElementById("cartCheckoutBtn");
  const cartGuestName = document.getElementById("cartGuestName");
  const cartGuestPhone = document.getElementById("cartGuestPhone");
  const cartStickyBar = document.getElementById("cartStickyBar");
  const cartStickyCount = document.getElementById("cartStickyCount");
  const cartStickyTotal = document.getElementById("cartStickyTotal");
  const bottomNavCartBadge = document.getElementById("bottomNavCartBadge");
  const navMore = document.getElementById("navMore");
  const moreMenu = document.getElementById("moreMenu");
  const moreMenuOverlay = document.getElementById("moreMenuOverlay");

  const moreWhatsapp = document.getElementById("moreWhatsapp");
  const moreInstagram = document.getElementById("moreInstagram");
  const moreFacebook = document.getElementById("moreFacebook");
  const moreLoginBtn = document.getElementById("moreLoginBtn");

  if (moreWhatsapp) {
    moreWhatsapp.href = genericWaLink(
      `Hi, I'm interested in ${SITE_CONFIG.shopName}.`,
    );
  }

  if (moreInstagram) {
    moreInstagram.href = SITE_CONFIG.instagramUrl;
  }
  if (moreFacebook) {
    moreFacebook.href = "https://www.facebook.com/share/1Fb87EVtyh/";
  }

  // Prefill remembered guest details
  const savedGuest = loadGuest();
  if (cartGuestName) cartGuestName.value = savedGuest.name || "";
  if (cartGuestPhone) cartGuestPhone.value = savedGuest.phone || "";

  // function openCart() {
  //   cartOverlay.classList.add("open");
  //   document.body.classList.add("modal-open");
  // }
  function openCart() {
    cartOverlay.classList.add("open");
    document.body.classList.add("modal-open");

    if (cartStickyBar) {
      cartStickyBar.style.display = "none";
    }
  }
  // function closeCart() {
  //   cartOverlay.classList.remove("open");
  //   document.body.classList.remove("modal-open");
  // }
  function closeCart() {
    cartOverlay.classList.remove("open");
    document.body.classList.remove("modal-open");

    if (cartStickyBar && cartCount() > 0) {
      cartStickyBar.style.display = "flex";
    }
  }

  if (cartBtn) cartBtn.addEventListener("click", openCart);
  if (cartCloseBtn) cartCloseBtn.addEventListener("click", closeCart);
  if (cartOverlay) {
    cartOverlay.addEventListener("click", (e) => {
      if (e.target === cartOverlay) closeCart();
    });
  }
  if (cartStickyBar) cartStickyBar.addEventListener("click", openCart);
  if (cartEmptyBrowseBtn) {
    cartEmptyBrowseBtn.addEventListener("click", () => {
      closeCart();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    });
  }

  const cartDownloadPdfBtn = document.getElementById("cartDownloadPdfBtn");
  if (cartDownloadPdfBtn) {
    cartDownloadPdfBtn.addEventListener("click", downloadCartPdf);
  }

  // Writes a lightweight snapshot of the current cart to a top-level
  // "orders" collection — fire-and-forget, never blocks checkout/PDF if it
  // fails (e.g. offline), since the WhatsApp message is the source of truth
  // for actually placing the order.
  async function saveOrderRecord(channel) {
    if (!cart.length) return;
    const guest = loadGuest();
    try {
      await db.collection("orders").add({
        userId: currentUser ? currentUser.uid : null,
        customerName: guest.name || null,
        customerPhone: guest.phone || null,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          color: item.color || null,
          qty: item.qty,
          price: item.price,
          imageUrl: item.imageUrl || null,
        })),
        total: cartTotalAmount(),
        channel: channel, // "whatsapp" | "pdf"
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("Couldn't save order record:", err);
    }
  }

  // NOTE: the actual "place order" click handler lives further down
  // (near the checkout modal / WhatsApp message builder). It calls
  // saveOrderRecord's job itself now, so we don't double-attach a
  // second, differently-shaped order write here.

  // Best-effort fetch of a remote product image as a data URL so it can be
  // embedded in the PDF. Resolves to null (never rejects) if the image is
  // missing, blocked by CORS, or fails to load — callers just skip the
  // thumbnail and fall back to a placeholder box in that case.
  function loadImageAsDataUrl(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL("image/jpeg", 0.85),
            ratio: img.naturalWidth / img.naturalHeight || 1,
          });
        } catch (e) {
          resolve(null); // canvas got tainted (CORS) — skip thumbnail
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // async function downloadCartPdf() {
  //   if (!cart.length) return;

  //   if (!window.jspdf || !window.jspdf.jsPDF) {
  //     alert(
  //       "Couldn't load the PDF tool. Please check your connection and try again.",
  //     );
  //     return;
  //   }

  //   if (cartDownloadPdfBtn) {
  //     cartDownloadPdfBtn.disabled = true;
  //     cartDownloadPdfBtn.dataset.originalLabel =
  //       cartDownloadPdfBtn.dataset.originalLabel ||
  //       cartDownloadPdfBtn.innerHTML;
  //     cartDownloadPdfBtn.innerHTML = "Preparing PDF…";
  //   }

  //   try {
  //     const thumbs = await Promise.all(
  //       cart.map((item) => loadImageAsDataUrl(item.imageUrl)),
  //     );

  //     const { jsPDF } = window.jspdf;
  //     const doc = new jsPDF();
  //     // ==============================
  //     // Shop Information
  //     // ==============================

  //     const shopName = "ZENVEERA WORLD";
  //     const tagline = "Good Choice For You";
  //     const shopPhone = "+91 7990818211";
  //     const shopAddress = "Your Shop Address";

  //     // ==============================
  //     // Invoice Information
  //     // ==============================

  //     const now = new Date();

  //     const invoiceNo =
  //       "ZW-" +
  //       now.getFullYear() +
  //       String(now.getMonth() + 1).padStart(2, "0") +
  //       String(now.getDate()).padStart(2, "0") +
  //       "-" +
  //       Date.now().toString().slice(-5);

  //     const invoiceDate = now.toLocaleDateString("en-IN");

  //     const invoiceTime = now.toLocaleTimeString("en-IN", {
  //       hour: "2-digit",
  //       minute: "2-digit",
  //     });
  //     const guest = loadGuest();
  //     const pageHeight = doc.internal.pageSize.getHeight();
  //     const marginBottom = 30;
  //     const imgSize = 18; // mm square thumbnail box
  //     const rowHeight = 24;

  //     let y = 20;

  //     function drawHeader() {
  //       y = 20;

  //       doc.setFont("helvetica", "bold");
  //       doc.setFontSize(18);
  //       doc.text(shopName, 105, y, { align: "center" });

  //       y += 6;

  //       doc.setFont("helvetica", "normal");
  //       doc.setFontSize(10);
  //       doc.text(tagline, 105, y, { align: "center" });

  //       y += 6;

  //       doc.text(shopPhone, 105, y, { align: "center" });

  //       y += 10;

  //       doc.setDrawColor(180);
  //       doc.line(14, y, 196, y);

  //       y += 8;

  //       doc.setFont("helvetica", "bold");
  //       doc.setFontSize(14);
  //       doc.text("ORDER QUOTATION", 105, y, { align: "center" });

  //       y += 10;

  //       doc.setFontSize(10);
  //       doc.setFont("helvetica", "normal");

  //       doc.text("Invoice No : " + invoiceNo, 14, y);
  //       doc.text("Date : " + invoiceDate, 196, y, { align: "right" });

  //       y += 6;

  //       doc.text("Time : " + invoiceTime, 14, y);

  //       y += 10;
  //     }

  //     drawHeader();

  //     cart.forEach((item, i) => {
  //       if (y + rowHeight > pageHeight - marginBottom) {
  //         doc.addPage();
  //         y = 20;
  //         drawHeader();
  //       }

  //       const thumb = thumbs[i];
  //       if (thumb) {
  //         const h = imgSize;
  //         const w = Math.min(imgSize, imgSize * thumb.ratio);
  //         try {
  //           doc.addImage(thumb.dataUrl, "JPEG", 14, y - 5, w, h);
  //         } catch (e) {
  //           /* embedding failed silently — text-only row still renders */
  //         }
  //       } else {
  //         doc.setDrawColor(225);
  //         doc.rect(14, y - 5, imgSize, imgSize);
  //         doc.setFontSize(7);
  //         doc.setTextColor(180);
  //         doc.text("no image", 14 + imgSize / 2, y - 5 + imgSize / 2, {
  //           align: "center",
  //         });
  //         doc.setTextColor(0);
  //       }

  //       const textX = 14 + imgSize + 4;
  //       doc.setFont("helvetica", "bold");
  //       doc.setFontSize(10);
  //       doc.text(item.name || "Untitled", textX, y, { maxWidth: 110 });

  //       doc.setFont("helvetica", "normal");
  //       doc.setFontSize(9);
  //       doc.setTextColor(120);
  //       let subLine = money(item.price) + " each";
  //       if (item.color) subLine += "  •  Color: " + item.color;
  //       doc.text(subLine, textX, y + 5, { maxWidth: 110 });
  //       doc.setTextColor(0);

  //       doc.setFontSize(10);
  //       doc.text(String(item.qty), 150, y, { align: "right" });
  //       doc.text(money(item.price * item.qty), 196, y, { align: "right" });

  //       y += rowHeight;
  //     });

  //     doc.setDrawColor(220);
  //     doc.line(14, y - 6, 196, y - 6);

  //     doc.setFont("helvetica", "bold");
  //     doc.setFontSize(13);
  //     doc.text("Total", 14, y);
  //     doc.text(money(cartTotalAmount()), 196, y, { align: "right" });
  //     y += 4;

  //     if (guest.name || guest.phone) {
  //       y += 12;
  //       doc.setFont("helvetica", "normal");
  //       doc.setFontSize(10);
  //       doc.text("Customer details", 14, y);
  //       y += 6;
  //       // if (guest.name) {
  //       //   doc.text("Name: " + guest.name, 14, y);
  //       //   y += 6;
  //       // }
  //       // if (guest.phone) {
  //       //   doc.text("Phone: " + guest.phone, 14, y);
  //       //   y += 6;
  //       // }
  //       y += 6;

  //       doc.setDrawColor(220);
  //       doc.line(14, y, 196, y);

  //       y += 8;

  //       doc.setFont("helvetica", "bold");
  //       doc.setFontSize(12);
  //       doc.text("Customer Details", 14, y);

  //       y += 8;

  //       doc.setFont("helvetica", "normal");
  //       doc.setFontSize(10);

  //       doc.text("Name : " + (guest.name || "-"), 14, y);

  //       y += 6;

  //       doc.text("Phone : " + (guest.phone || "-"), 14, y);

  //       y += 6;

  //       doc.text("Email : " + (currentUser?.email || "-"), 14, y);

  //       y += 10;
  //     }

  //     // y += 12;
  //     // doc.setFontSize(9);
  //     // doc.setTextColor(120);
  //     // doc.text(
  //     //   "This is not an invoice. Please confirm availability and payment with the shop over WhatsApp.",
  //     //   14,
  //     //   y,
  //     //   { maxWidth: 182 },
  //     // );
  //     y += 6;

  //     doc.setDrawColor(220);
  //     doc.line(14, y, 196, y);

  //     y += 8;

  //     doc.setFont("helvetica", "bold");
  //     doc.setFontSize(12);
  //     doc.text("Customer Details", 14, y);

  //     y += 8;

  //     doc.setFont("helvetica", "normal");
  //     doc.setFontSize(10);

  //     doc.text("Name : " + (guest.name || "-"), 14, y);

  //     y += 6;

  //     doc.text("Phone : " + (guest.phone || "-"), 14, y);

  //     y += 6;

  //     doc.text("Email : " + (currentUser?.email || "-"), 14, y);

  //     y += 10;

  //     const fileName = `${SITE_CONFIG.shopName.replace(/\s+/g, "_")}_order.pdf`;
  //     doc.save(fileName);
  //     saveOrderRecord("pdf");
  //   } catch (err) {
  //     console.error(err);
  //     alert("Something went wrong creating the PDF. Please try again.");
  //   } finally {
  //     if (cartDownloadPdfBtn) {
  //       cartDownloadPdfBtn.disabled = false;
  //       cartDownloadPdfBtn.innerHTML = cartDownloadPdfBtn.dataset.originalLabel;
  //     }
  //   }
  // }

  async function downloadCartPdf() {
    if (!cart.length) return;

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert(
        "Couldn't load the PDF tool. Please check your connection and try again.",
      );
      return;
    }

    if (cartDownloadPdfBtn) {
      cartDownloadPdfBtn.disabled = true;
      cartDownloadPdfBtn.dataset.originalLabel =
        cartDownloadPdfBtn.dataset.originalLabel ||
        cartDownloadPdfBtn.innerHTML;
      cartDownloadPdfBtn.innerHTML = "Preparing PDF…";
    }

    try {
      const thumbs = await Promise.all(
        cart.map((item) => loadImageAsDataUrl(item.imageUrl)),
      );

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // ==============================
      // Brand palette (matches visiting card)
      // ==============================
      const BLUE = [24, 62, 145];
      const BLUE_LIGHT = [232, 238, 250];
      const ORANGE = [242, 130, 34];
      const GREY_TEXT = [100, 100, 100];
      const GREY_LINE = [225, 225, 225];
      const HEADER_BG = [238, 238, 240];
      const ROW_ALT = [248, 249, 252];
      const WHITE = [255, 255, 255];

      // Currency: jsPDF's built-in Helvetica has no ₹ glyph — it renders as a
      // broken "¹" superscript. Using "Rs." guarantees correct rendering
      // everywhere without embedding a custom Unicode font.
      const currency = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN");

      // ==============================
      // Shop Information
      // ==============================
      const shopName = "ZENVEERA WORLD";
      const tagline = "Good Choice For You";
      const shopCategories = "Wholesale  \u2022  Retail  \u2022  E-Commerce";
      const shopPhone = "+91 7990818211";
      const shopEmail = "zenveeraworld2511@gmail.com";
      const shopAddressLine =
        "Shp.15, Sahjanand Shine, Near Water Guda Tank, Vavol, Gandhinagar - 382016";

      // ==============================
      // Quotation Information
      // ==============================
      const now = new Date();
      const quotationNo =
        "ZW-" +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        "-" +
        Date.now().toString().slice(-5);

      const quotationDate = now.toLocaleDateString("en-IN");
      const quotationTime = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const guest = loadGuest();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 12;
      const contentRight = pageWidth - marginX;
      const marginBottom = 20;

      // Compact table geometry — modeled on a dense line-item invoice, not
      // one big card per product.
      const imgSize = 12; // mm square thumbnail (small, like a real table)
      const rowHeight = 14; // mm per product row
      const colImgX = marginX + 1;
      const colNameX = marginX + imgSize + 6;
      const colQtyX = 140;
      const colPriceX = 165;
      const colTotalX = contentRight;

      let y = 0;

      // ------------------------------
      // Header banner (drawn on every page)
      // ------------------------------
      function drawHeader(isFirstPage) {
        y = 0;
        const bannerHeight = isFirstPage ? 34 : 18;

        doc.setFillColor(...BLUE);
        doc.rect(0, 0, pageWidth, bannerHeight, "F");
        doc.setFillColor(...ORANGE);
        doc.rect(0, bannerHeight, pageWidth, 1, "F");

        if (isFirstPage) {
          doc.setTextColor(...WHITE);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(17);
          doc.text(shopName, pageWidth / 2, 12, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text(tagline, pageWidth / 2, 18, { align: "center" });
          doc.setFontSize(8);
          doc.text(shopCategories, pageWidth / 2, 23, { align: "center" });

          doc.setFontSize(7.5);
          doc.text(
            `${shopAddressLine}   |   ${shopPhone}   |   ${shopEmail}`,
            pageWidth / 2,
            29,
            { align: "center", maxWidth: pageWidth - 16 },
          );
          doc.setTextColor(0, 0, 0);

          y = bannerHeight + 10;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(...BLUE);
          doc.text("ORDER QUOTATION", pageWidth / 2, y, { align: "center" });
          doc.setTextColor(0, 0, 0);

          y += 7;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...GREY_TEXT);
          doc.text(`Quotation No: ${quotationNo}`, marginX, y);
          doc.text(
            `Date: ${quotationDate}   Time: ${quotationTime}`,
            contentRight,
            y,
            { align: "right" },
          );
          doc.setTextColor(0, 0, 0);

          y += 5;
          const cardTop = y;
          const cardHeight = 16;
          doc.setFillColor(...BLUE_LIGHT);
          doc.roundedRect(
            marginX,
            cardTop,
            contentRight - marginX,
            cardHeight,
            2,
            2,
            "F",
          );
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...BLUE);
          doc.text("Customer:", marginX + 4, cardTop + 6);
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.text(
            `${guest.name || "-"}   |   Ph: ${guest.phone || "-"}   |   Email: ${currentUser?.email || "-"}`,
            marginX + 24,
            cardTop + 6,
          );

          y = cardTop + cardHeight + 6;
        } else {
          doc.setTextColor(...WHITE);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text(shopName, marginX, 11);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.text("ORDER QUOTATION", contentRight, 11, { align: "right" });
          doc.setTextColor(0, 0, 0);
          y = bannerHeight + 8;
        }

        drawTableHeader();
      }

      function drawTableHeader() {
        doc.setFillColor(...HEADER_BG);
        doc.rect(marginX, y - 4.5, contentRight - marginX, 7, "F");
        doc.setDrawColor(...GREY_LINE);
        doc.rect(marginX, y - 4.5, contentRight - marginX, 7);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 50);
        doc.text("Image", colImgX, y);
        doc.text("Product", colNameX, y);
        doc.text("Qty", colQtyX, y, { align: "right" });
        doc.text("Price", colPriceX, y, { align: "right" });
        doc.text("Total", colTotalX, y, { align: "right" });
        doc.setTextColor(0, 0, 0);
        y += 8;
      }

      function drawFooter(totalPages) {
        const footerY = pageHeight - 10;
        doc.setDrawColor(...GREY_LINE);
        doc.line(marginX, footerY - 5, contentRight, footerY - 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY_TEXT);
        doc.text(`${shopName} \u2014 ${tagline}`, marginX, footerY);
        doc.text(
          `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${totalPages}`,
          contentRight,
          footerY,
          { align: "right" },
        );
        doc.setTextColor(0, 0, 0);
      }

      // ------------------------------
      // Build content
      // ------------------------------
      drawHeader(true);

      cart.forEach((item, i) => {
        if (y + rowHeight > pageHeight - marginBottom) {
          doc.addPage();
          drawHeader(false);
        }

        const rowTop = y - 5;

        if (i % 2 === 1) {
          doc.setFillColor(...ROW_ALT);
          doc.rect(marginX, rowTop, contentRight - marginX, rowHeight, "F");
        }

        const thumb = thumbs[i];
        if (thumb) {
          const h = imgSize;
          const w = Math.min(imgSize, imgSize * thumb.ratio);
          try {
            doc.addImage(thumb.dataUrl, "JPEG", colImgX, rowTop + 1, w, h);
          } catch (e) {
            /* embedding failed silently — text-only row still renders */
          }
        } else {
          doc.setDrawColor(...GREY_LINE);
          doc.rect(colImgX, rowTop + 1, imgSize, imgSize);
        }

        const nameY = rowTop + 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(item.name || "Untitled", colNameX, nameY, { maxWidth: 78 });

        if (item.color) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(...GREY_TEXT);
          doc.text(`Color: ${item.color}`, colNameX, nameY + 4.5, {
            maxWidth: 78,
          });
          doc.setTextColor(0, 0, 0);
        }

        const midY = rowTop + rowHeight / 2 + 2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(String(item.qty), colQtyX, midY, { align: "right" });
        doc.text(currency(item.price), colPriceX, midY, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.text(currency(item.price * item.qty), colTotalX, midY, {
          align: "right",
        });
        doc.setFont("helvetica", "normal");

        doc.setDrawColor(...GREY_LINE);
        doc.line(marginX, rowTop + rowHeight, contentRight, rowTop + rowHeight);

        y += rowHeight;
      });

      // Grand total — styled as the final row of the table (bold, light
      // shaded background, top/bottom borders) instead of a separate box.
      if (y + 14 > pageHeight - marginBottom) {
        doc.addPage();
        drawHeader(false);
      }

      const gtRowTop = y - 5;
      const gtRowHeight = 12;
      doc.setFillColor(...BLUE_LIGHT);
      doc.rect(marginX, gtRowTop, contentRight - marginX, gtRowHeight, "F");
      doc.setDrawColor(...BLUE);
      doc.setLineWidth(0.4);
      doc.line(marginX, gtRowTop, contentRight, gtRowTop);
      doc.line(
        marginX,
        gtRowTop + gtRowHeight,
        contentRight,
        gtRowTop + gtRowHeight,
      );
      doc.setLineWidth(0.2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...BLUE);
      doc.text("GRAND TOTAL", colNameX, gtRowTop + gtRowHeight / 2 + 2);
      doc.text(
        currency(cartTotalAmount()),
        colTotalX,
        gtRowTop + gtRowHeight / 2 + 2,
        { align: "right" },
      );
      doc.setTextColor(0, 0, 0);
      y = gtRowTop + gtRowHeight + 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...ORANGE);
      doc.text("Payment Status:  Quotation Only", marginX, y);
      doc.setTextColor(0, 0, 0);
      y += 7;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY_TEXT);
      doc.text(
        "Prices are subject to product availability. This quotation is generated digitally and does not require a signature.",
        marginX,
        y,
        { maxWidth: contentRight - marginX },
      );
      doc.setTextColor(0, 0, 0);
      y += 10;

      if (y + 16 > pageHeight - marginBottom) {
        doc.addPage();
        drawHeader(false);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...BLUE);
      doc.text("Thank You For Choosing Zenveera World", marginX, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(
        `For order assistance: ${shopPhone}   |   Instagram: @zenveeraworld`,
        marginX,
        y,
      );

      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...ORANGE);
      doc.text(
        `Chat with us on WhatsApp: ${shopPhone}   or   Visit our Shop`,
        marginX,
        y,
      );
      doc.setTextColor(0, 0, 0);

      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawFooter(totalPages);
      }

      const fileName = `${SITE_CONFIG.shopName.replace(/\s+/g, "_")}_quotation.pdf`;
      doc.save(fileName);
      saveOrderRecord("pdf");
    } catch (err) {
      console.error(err);
      alert("Something went wrong creating the PDF. Please try again.");
    } finally {
      if (cartDownloadPdfBtn) {
        cartDownloadPdfBtn.disabled = false;
        cartDownloadPdfBtn.innerHTML = cartDownloadPdfBtn.dataset.originalLabel;
      }
    }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cartOverlay.classList.contains("open")) {
      closeCart();
    }
  });

  [cartGuestName, cartGuestPhone].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      saveGuest({
        name: cartGuestName ? cartGuestName.value.trim() : "",
        phone: cartGuestPhone ? cartGuestPhone.value.trim() : "",
      });
    });
  });

  function renderCartUI() {
    const count = cartCount();
    const total = cartTotalAmount();

    // Badge in header
    if (cartBadge) {
      cartBadge.textContent = count;
      cartBadge.style.display = count > 0 ? "flex" : "none";
    }

    // Badge in mobile bottom nav
    if (bottomNavCartBadge) {
      bottomNavCartBadge.textContent = count;
      bottomNavCartBadge.style.display = count > 0 ? "flex" : "none";
    }

    // Mobile sticky bar
    if (cartStickyBar) {
      cartStickyBar.style.display = count > 0 ? "flex" : "none";
      document.body.classList.toggle("cart-bar-visible", count > 0);
      if (cartStickyCount) cartStickyCount.textContent = count;
      if (cartStickyTotal) cartStickyTotal.textContent = money(total);
    }

    // Drawer contents
    if (!cart.length) {
      if (cartItemsEl) cartItemsEl.style.display = "none";
      if (cartFooterEl) cartFooterEl.style.display = "none";
      if (cartEmptyEl) cartEmptyEl.style.display = "flex";
      return;
    }

    if (cartItemsEl) cartItemsEl.style.display = "block";
    if (cartFooterEl) cartFooterEl.style.display = "block";
    if (cartEmptyEl) cartEmptyEl.style.display = "none";

    if (cartItemsEl) {
      cartItemsEl.innerHTML = cart
        .map(
          (item) => `
        <div class="cart-line" data-id="${item.cartId}">
          <div class="cart-line-img" style="${item.imageUrl ? `background-image:url('${item.imageUrl}')` : ""}"></div>
          <div class="cart-line-info">
            <p class="cart-line-name">${escapeHtml(item.name)}</p>
            ${item.color ? `<p class="cart-line-color">Color: ${escapeHtml(item.color)}</p>` : ""}
            <div class="cart-line-price">${money(item.price)}</div>
            <div class="cart-line-controls">
              <div class="qty-stepper">
                <button type="button" class="cart-qty-minus" aria-label="Decrease quantity">−</button>
                <span>${item.qty}</span>
                <button type="button" class="cart-qty-plus" aria-label="Increase quantity">+</button>
              </div>
              <button type="button" class="cart-line-remove">Remove</button>
            </div>
          </div>
        </div>
      `,
        )
        .join("");
    }

    if (cartTotalEl) cartTotalEl.textContent = money(total);

    if (cartCheckoutBtn) {
      cartCheckoutBtn.href = buildCartWaLink();
    }
  }

  if (cartItemsEl) {
    cartItemsEl.addEventListener("click", (e) => {
      const line = e.target.closest(".cart-line");
      if (!line) return;
      const id = line.dataset.id;
      const item = findCartItem(id);
      if (!item) return;

      if (e.target.closest(".cart-qty-plus")) {
        setCartQty(id, item.qty + 1);
      } else if (e.target.closest(".cart-qty-minus")) {
        setCartQty(id, item.qty - 1);
      } else if (e.target.closest(".cart-line-remove")) {
        removeFromCart(id);
      }
    });
  }

  function buildCartWaLink() {
    const guest = loadGuest();
    const lines = cart
      .map((item, i) => {
        let line = `${i + 1}. ${item.name}`;
        if (item.color) line += ` (${item.color})`;
        line += ` × ${item.qty} — ${money(item.price * item.qty)}`;
        if (item.imageUrl) line += `\n   🖼️ ${item.imageUrl}`;
        return line;
      })
      .join("\n");

    let message = `🛍️ ${SITE_CONFIG.shopName}\n\nHi, I'd like to order:\n\n${lines}\n\nTotal: ${money(cartTotalAmount())}`;

    if (guest.name || guest.phone) {
      message += `\n\nMy details:`;
      if (guest.name) message += `\nName: ${guest.name}`;
      if (guest.phone) message += `\nPhone: ${guest.phone}`;
    }

    message += `\n\nPlease confirm availability and how to pay. Thank you!`;

    return genericWaLink(message);
  }

  renderCartUI();
  renderProducts();

  /* ==========================================================
     3d. MY ORDERS DRAWER (customer-facing order history + status)
  ========================================================== */
  const ordersOverlay = document.getElementById("ordersOverlay");
  const ordersCloseBtn = document.getElementById("ordersCloseBtn");
  const ordersList = document.getElementById("ordersList");
  const ordersEmpty = document.getElementById("ordersEmpty");
  const ordersEmptyBrowseBtn = document.getElementById("ordersEmptyBrowseBtn");
  const bottomNavOrders = document.getElementById("bottomNavOrders");
  const ordersHeaderBtn = document.getElementById("ordersHeaderBtn");

  let ordersUnsubscribe = null; // stops the live listener when we log out

  function openOrders() {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }
    ordersOverlay.classList.add("open");
    document.body.classList.add("modal-open");
  }

  function closeOrders() {
    ordersOverlay.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  function orderStatusLabel(status) {
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    return "Pending";
  }

  function renderOrdersList(orders) {
    if (!orders.length) {
      ordersList.style.display = "none";
      ordersEmpty.style.display = "flex";
      return;
    }
    ordersList.style.display = "block";
    ordersEmpty.style.display = "none";

    ordersList.innerHTML = orders
      .map((order) => {
        const status = order.status || "pending";
        const dateStr =
          order.createdAt && typeof order.createdAt.toDate === "function"
            ? order.createdAt.toDate().toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "";

        const itemsStr = (order.items || [])
          .map((it) => `${escapeHtml(it.name)} × ${it.qty}`)
          .join(", ");

        return `
          <div class="order-card-mini">
            <div class="order-card-mini-top">
              <span class="order-card-mini-id">${escapeHtml(order.orderId || order.id)}</span>
              <span class="order-status-pill ${status}">${orderStatusLabel(status)}</span>
            </div>
            <p class="order-card-mini-date">${dateStr}</p>
            <p class="order-card-mini-items">${itemsStr}</p>
            <div class="order-card-mini-total">
              <span>Total</span>
              <span>${money(order.total)}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Attaches (or re-attaches) a live listener scoped to the logged-in
  // customer's own orders, so status changes made by the admin (pending ->
  // completed/cancelled) show up instantly without the customer refreshing.
  function listenToUserOrders() {
    if (ordersUnsubscribe) {
      ordersUnsubscribe();
      ordersUnsubscribe = null;
    }
    if (!currentUser) {
      renderOrdersList([]);
      return;
    }

    ordersUnsubscribe = db
      .collection("orders")
      .where("userId", "==", currentUser.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          const orders = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          renderOrdersList(orders);
        },
        (err) => {
          console.error("Couldn't load orders:", err);
          ordersList.style.display = "none";
          ordersEmpty.style.display = "flex";
          ordersEmpty.querySelector("p").textContent =
            "Couldn't load your orders right now. Please try again shortly.";
        },
      );
  }

  if (bottomNavOrders) bottomNavOrders.addEventListener("click", openOrders);
  if (ordersHeaderBtn) ordersHeaderBtn.addEventListener("click", openOrders)
  if (ordersCloseBtn) ordersCloseBtn.addEventListener("click", closeOrders);
  if (ordersOverlay) {
    ordersOverlay.addEventListener("click", (e) => {
      if (e.target === ordersOverlay) closeOrders();
    });
  }
  if (ordersEmptyBrowseBtn) {
    ordersEmptyBrowseBtn.addEventListener("click", () => {
      closeOrders();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ordersOverlay.classList.contains("open")) {
      closeOrders();
    }
  });

  /* ==========================================================
     4. SCROLL-REVEAL (fade cards in as they enter the viewport)
  ========================================================== */
  const revealObserver =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("in-view");
                revealObserver.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12 },
        )
      : null;
  function getFilteredProducts() {
    let filtered = allProducts;

    if (currentFilter === "in-stock") {
      filtered = filtered.filter((p) => p.inStock !== false);
    }

    if (currentCategory === "offers") {
      filtered = filtered.filter((p) => p.onSale);
    } else if (currentCategory !== "all") {
      filtered = filtered.filter((p) => p.category === currentCategory);
    }

    if (newOnly) {
      filtered = filtered.filter(isNewProduct);
    }

    if (searchText) {
      filtered = filtered.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(searchText) ||
          (p.category || "").toLowerCase().includes(searchText),
      );
    }

    return filtered;
  }
  /* ==========================================================
     5. RENDER PRODUCT GRID
  ========================================================== */
  function renderProducts() {
    // let filtered = allProducts;
    let filtered = getFilteredProducts();

    // if (currentFilter === "in-stock") {
    //   filtered = filtered.filter((p) => p.inStock !== false);
    // }

    // if (currentCategory === "offers") {
    //   filtered = filtered.filter((p) => p.onSale);
    // } else if (currentCategory !== "all") {
    //   filtered = filtered.filter((p) => p.category === currentCategory);
    // }

    // if (newOnly) {
    //   filtered = filtered.filter(isNewProduct);
    // }

    // if (searchText) {
    //   filtered = filtered.filter(
    //     (p) =>
    //       (p.name || "").toLowerCase().includes(searchText) ||
    //       (p.category || "").toLowerCase().includes(searchText),
    //   );
    // }

    // ---- Stat banner ----
    if (catalogIntro) {
      const total = allProducts.length;
      const showingAll = filtered.length === total;
      catalogIntro.innerHTML = showingAll
        ? `<i class="fa-solid fa-bag-shopping"></i> ${total} product${total === 1 ? "" : "s"} available across all categories`
        : `<i class="fa-solid fa-bag-shopping"></i> Showing ${Math.min(filtered.length, visibleCount)} of ${filtered.length} matching product${filtered.length === 1 ? "" : "s"}`;
    }

    grid.innerHTML = "";

    if (!filtered.length) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    const toRender = filtered.slice(0, visibleCount);

    toRender.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card" + (p.inStock === false ? " out-of-stock" : "");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.dataset.id = p.id;

      // const imgStyle = p.imageUrl
      //   ? `background-image:url('${p.imageUrl}')`
      //   : "";

      const swatchesHtml = (p.colors || [])
        .slice(0, 5)
        .map(
          (c) =>
            `<span class="swatch" style="background:${c.hex || "#ccc"}" title="${escapeHtml(c.name || "")}"></span>`,
        )
        .join("");
      const moreCount = (p.colors || []).length - 5;

      card.innerHTML = `
        ${p.inStock === false ? '<div class="stamp">Out of stock</div>' : ""}
        ${isNewProduct(p) ? '<div class="ribbon-new">New</div>' : ""}

${p.onSale ? '<div class="offer-badge">🔥 OFFER</div>' : ""}
        <div class="card-image">
    ${
      p.imageUrl
        ? `<img src="${p.imageUrl}"
               alt="${escapeHtml(p.name || "Product")}"
               loading="lazy">`
        : `<div class="no-image">No Image</div>`
    }
</div>
        <div class="card-body">
          <h3 class="card-name">${escapeHtml(p.name || "Untitled")}</h3>
        <div class="card-price">

${
  p.onSale
    ? `
<div class="offer-price">

<span class="new-price">
${money(p.discountPrice)}
</span>

<span class="old-price">
${money(p.originalPrice)}
</span>

</div>
`
    : money(p.price)
}

</div>
          
          ${p.category ? `<div class="card-meta">${escapeHtml(p.category)}</div>` : ""}
          <div class="card-swatches">
            ${swatchesHtml}
            ${moreCount > 0 ? `<span class="swatch-more">+${moreCount}</span>` : ""}
          </div>
          <div class="card-actions">
            <button type="button" class="card-btn" data-view-id="${p.id}">View</button>
            <button
              type="button"
              class="card-add-btn"
              data-add-id="${p.id}"
              ${p.inStock === false ? "disabled" : ""}
            >
              <i class="fa-solid fa-cart-plus"></i> ${p.inStock === false ? "Out of stock" : "Add"}
            </button>
          </div>
        </div>
      `;
      card.addEventListener("click", (e) => {
        // Quick-add button handles its own click — don't also open the modal
        if (e.target.closest(".card-add-btn")) return;
        openModal(p);
      });
      card.addEventListener("keypress", (e) => {
        if (e.key === "Enter") openModal(p);
      });

     const quickAddBtn = card.querySelector(".card-add-btn");

if (quickAddBtn) {

    // if (cart.some(item => item.id === p.id && !item.color)) {
    //     quickAddBtn.classList.add("added");
    //     quickAddBtn.innerHTML = `<i class="fa-solid fa-check"></i> Added`;
    // }
  const inCart = cart.some(item => item.id === p.id);

if (inCart) {
    quickAddBtn.classList.add("added");
    quickAddBtn.innerHTML = `<i class="fa-solid fa-check"></i> Added`;
} else {
    quickAddBtn.classList.remove("added");
    quickAddBtn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> Add`;
}

    quickAddBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        if (p.inStock === false) return;

        if (cart.some(item => item.id === p.id && !item.color)) return;

        const added = await addToCart(p, 1);

if (!added) return;

quickAddBtn.classList.add("added");
quickAddBtn.innerHTML = `<i class="fa-solid fa-check"></i> Added`;
    });
}

      grid.appendChild(card);

      if (revealObserver) {
        revealObserver.observe(card);
      } else {
        card.classList.add("in-view");
      }
    });
  }

  /* ==========================================================
     6. SEARCH
  ========================================================== */
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchText = this.value.toLowerCase().trim();
      resetPaging();
      renderProducts();
    });
  }

  /* ==========================================================
     7. FILTER CHIPS (category + In Stock + New — single row)
  ========================================================== */
  // After any filter chip click, bring the top of the product grid into
  // view — otherwise the newly filtered results render wherever the
  // person happened to be scrolled, off-screen above their current view.
  // function scrollToCatalogTop() {
  //   const catalogSection = document.getElementById("catalog");
  //   if (catalogSection) {
  //     catalogSection.scrollIntoView({ behavior: "smooth", block: "start" });
  //   } else if (filterRow) {
  //     filterRow.scrollIntoView({ behavior: "smooth", block: "start" });
  //   }
  // }
function scrollToCatalogTop() {
    const catalogSection = document.getElementById("catalog");
    const stickyBar = document.querySelector(".sticky-topbar");
    if (catalogSection) {
      const offset = stickyBar ? stickyBar.offsetHeight : 0;
      const top = catalogSection.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    } else if (filterRow) {
      filterRow.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  const filterRow = document.getElementById("filterRow");
  if (filterRow) {
    filterRow.addEventListener("click", (e) => {
      const catBtn = e.target.closest("[data-category]");
      if (catBtn) {
        currentCategory = catBtn.dataset.category;
        filterRow
          .querySelectorAll("[data-category]")
          .forEach((b) => b.classList.remove("active"));
        catBtn.classList.add("active");

        // Clicking "All" should reset every filter, not just category —
        // otherwise "New" / "In stock" stay stuck on even though "All"
        // now looks selected, and it takes an extra click to clear them.
       newOnly = false;
        const newBtnEl = filterRow.querySelector("[data-new]");
        if (newBtnEl) newBtnEl.classList.remove("active");

        // Clicking "All" additionally resets "In stock" too — a full reset.
        if (currentCategory === "all") {
          currentFilter = "all";

          const stockBtnEl = filterRow.querySelector(
            '[data-filter="in-stock"]',
          );
          if (stockBtnEl) stockBtnEl.classList.remove("active");
        }

        resetPaging();
        renderProducts();
        scrollToCatalogTop();
        return;
      }

      const stockBtn = e.target.closest('[data-filter="in-stock"]');
      if (stockBtn) {
        stockBtn.classList.toggle("active");
        currentFilter = stockBtn.classList.contains("active")
          ? "in-stock"
          : "all";
        resetPaging();
        renderProducts();
        scrollToCatalogTop();
        return;
      }

      const newBtn = e.target.closest("[data-new]");
      if (newBtn) {
        newBtn.classList.toggle("active");
        newOnly = newBtn.classList.contains("active");
        resetPaging();
        renderProducts();
        scrollToCatalogTop();
        return;
      }
    });
  }

  /* ==========================================================
     8. LOAD MORE
  ========================================================== */
  // if (loadMoreBtn) {
  //   loadMoreBtn.addEventListener("click", () => {
  //     visibleCount += PAGE_SIZE;
  //     renderProducts();
  //   });
  // }

  /* ==========================================================
     9. PRODUCT DETAIL MODAL
  ========================================================== */
  const modal = document.getElementById("productModal");
  const modalQtyValue = document.getElementById("modalQtyValue");
  const modalQtyMinus = document.getElementById("modalQtyMinus");
  const modalQtyPlus = document.getElementById("modalQtyPlus");
  const modalAddToCartBtn = document.getElementById("modalAddToCartBtn");

  let currentModalProduct = null;
  let currentModalQty = 1;
  let currentModalColor = null;

  function refreshModalQtyDisplay() {
    if (modalQtyValue) modalQtyValue.textContent = currentModalQty;
  }

  if (modalQtyMinus) {
    modalQtyMinus.addEventListener("click", () => {
      currentModalQty = Math.max(1, currentModalQty - 1);
      refreshModalQtyDisplay();
    });
  }
  if (modalQtyPlus) {
    modalQtyPlus.addEventListener("click", () => {
      currentModalQty += 1;
      refreshModalQtyDisplay();
    });
  }
  if (modalAddToCartBtn) {
    modalAddToCartBtn.addEventListener("click", () => {
      if (!currentModalProduct || currentModalProduct.inStock === false) return;
      addToCart(currentModalProduct, currentModalQty, currentModalColor);
      const original = modalAddToCartBtn.innerHTML;
      modalAddToCartBtn.innerHTML = `<i class="fa-solid fa-check"></i> Added to cart`;
      setTimeout(() => {
        modalAddToCartBtn.innerHTML = original;
      }, 1200);
    });
  }

  function openModal(p) {
    currentModalProduct = p;
    currentModalQty = 1;
    currentModalColor = null;
    refreshModalQtyDisplay();

    document.getElementById("modalEyebrow").textContent =
      p.inStock === false ? "Currently unavailable" : "Product";
    document.getElementById("modalName").textContent = p.name || "Untitled";
    // document.getElementById("modalPrice").textContent = money(p.price);
    const modalPrice = document.getElementById("modalPrice");

    if (p.onSale) {
      modalPrice.innerHTML = `
<span class="new-price">${money(p.discountPrice)}</span>

<span class="old-price">${money(p.originalPrice)}</span>
`;
    } else {
      modalPrice.textContent = money(p.price);
    }
    document.getElementById("modalDesc").textContent = p.description || "";
    // document.getElementById("modalImage").style.backgroundImage = p.imageUrl
    //   ? `url('${p.imageUrl}')`
    //   : "none";
    const modalImage = document.getElementById("modalImage");

    let currentImage = p.imageUrl;

    if (currentImage) {
      modalImage.style.backgroundImage = `url('${currentImage}')`;
    } else {
      modalImage.style.backgroundImage = "none";
    }
    document.getElementById("modalOosBanner").style.display =
      p.inStock === false ? "block" : "none";

    if (modalAddToCartBtn) {
      modalAddToCartBtn.disabled = p.inStock === false;
      modalAddToCartBtn.innerHTML =
        p.inStock === false
          ? `<i class="fa-solid fa-ban"></i> Out of stock`
          : `<i class="fa-solid fa-cart-plus"></i> Add to cart`;
    }

    const colorsWrap = document.getElementById("modalColorsWrap");
    const swatchesEl = document.getElementById("modalSwatches");
    if (p.colors && p.colors.length) {
      colorsWrap.style.display = "block";
      // swatchesEl.innerHTML = p.colors
      //   .map(
      //     (c, i) =>
      //       `<button type="button" class="modal-swatch" data-color="${escapeHtml(c.name || "")}"><span class="dot" style="background:${c.hex || "#ccc"}"></span>${escapeHtml(c.name || "")}</button>`,
      //   )
      //   .join("");
      swatchesEl.innerHTML =
        `
<button
type="button"
class="modal-swatch selected"
data-main="1">

First  

</button>
` +
        p.colors
          .map(
            (c) => `

<button
type="button"
class="modal-swatch"
data-color="${escapeHtml(c.name)}">

<span
class="dot"
style="background:${c.hex}">
</span>

${escapeHtml(c.name)}

</button>

`,
          )
          .join("");
      // Default to the first color so the cart always has a value if the
      // shop lists colors at all; the customer can still tap another one.
      currentModalColor = null;
      // swatchesEl.querySelectorAll(".modal-swatch").forEach((el, i) => {
      //   el.classList.toggle("selected", i === 0);
      //   el.addEventListener("click", () => {
      //     currentModalColor = el.dataset.color || null;
      //     swatchesEl
      //       .querySelectorAll(".modal-swatch")
      //       .forEach((s) => s.classList.remove("selected"));
      //     el.classList.add("selected");
      //   });
      // });
      //   el.addEventListener("click", () => {
      //     currentModalColor = el.dataset.color || null;

      //     swatchesEl
      //       .querySelectorAll(".modal-swatch")
      //       .forEach((s) => s.classList.remove("selected"));

      //     el.classList.add("selected");

      //     const selectedColor = p.colors.find(
      //       (c) => c.name === currentModalColor,
      //     );

      //     if (selectedColor && selectedColor.imageUrl) {
      //       modalImage.style.backgroundImage = `url('${selectedColor.imageUrl}')`;
      //     } else {
      //       modalImage.style.backgroundImage = `url('${p.imageUrl}')`;
      //     }
      //   });
      // } else {
      //   colorsWrap.style.display = "none";
      // }
      swatchesEl.querySelectorAll(".modal-swatch").forEach((el) => {
        el.addEventListener("click", () => {
          swatchesEl
            .querySelectorAll(".modal-swatch")
            .forEach((s) => s.classList.remove("selected"));

          el.classList.add("selected");

          // Main Image button
          if (el.dataset.main) {
            currentModalColor = null;

            modalImage.style.backgroundImage = `url('${p.imageUrl}')`;

            return;
          }

          currentModalColor = el.dataset.color;

          const selectedColor = p.colors.find(
            (c) => c.name === currentModalColor,
          );

          if (selectedColor && selectedColor.imageUrl) {
            modalImage.style.backgroundImage = `url('${selectedColor.imageUrl}')`;
          } else {
            modalImage.style.backgroundImage = `url('${p.imageUrl}')`;
          }
        });
      });
    } else {
      colorsWrap.style.display = "none";
    }
    document.getElementById("modalWaBtn").href = waLink(p);
    document.getElementById("modalCallBtn").href =
      "tel:" + SITE_CONFIG.phoneDisplay.replace(/[^\d+]/g, "");

    const modalPanelEl = modal.querySelector(".modal-panel");
    if (modalPanelEl) modalPanelEl.scrollTop = 0;

    modal.classList.add("open");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    modal.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  document
    .getElementById("modalCloseBtn")
    .addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  /* ==========================================================
     10. CHAT BUBBLE (FAQ ASSISTANT)
  ========================================================== */
  const chatToggleBtn = document.getElementById("chatToggleBtn");
  const chatPanel = document.getElementById("chatPanel");
  const chatCloseBtn = document.getElementById("chatCloseBtn");
  const chatBody = document.getElementById("chatBody");
  const chatQuickReplies = document.getElementById("chatQuickReplies");

  function addChatBubble(html, who) {
    const div = document.createElement("div");
    div.className = "chat-bubble " + (who || "bot");
    div.innerHTML = html;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  if (chatToggleBtn && chatPanel) {
    chatToggleBtn.addEventListener("click", () => {
      chatPanel.classList.toggle("open");
    });
  }
  if (chatCloseBtn && chatPanel) {
    chatCloseBtn.addEventListener("click", () => {
      chatPanel.classList.remove("open");
    });
  }

  if (chatQuickReplies) {
    chatQuickReplies.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-q]");
      if (!btn) return;

      addChatBubble(escapeHtml(btn.textContent.trim()), "user");

      const q = btn.dataset.q;
      if (q === "wholesale") {
        addChatBubble(
          SITE_CONFIG.wholesaleAvailable
            ? `✅ Yes, wholesale is available! ${escapeHtml(SITE_CONFIG.wholesaleText)}`
            : "Please message us on WhatsApp for wholesale enquiries.",
        );
      } else if (q === "location") {
        const mapsUrl =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(SITE_CONFIG.shopAddress);
        addChatBubble(
          `📍 ${escapeHtml(SITE_CONFIG.shopAddress)}<br><a href="${mapsUrl}" target="_blank" rel="noopener">Open in Google Maps →</a>`,
        );
      } else if (q === "timing") {
        addChatBubble(`🕒 ${escapeHtml(SITE_CONFIG.shopTimings)}`);
      } else if (q === "whatsapp") {
        window.open(
          genericWaLink(`Hi, I have a question about ${SITE_CONFIG.shopName}.`),
          "_blank",
        );
      }
    });
  }

  /* ==========================================================
     11. LOAD PRODUCTS FROM FIRESTORE (live updates)
  ========================================================== */
  db.collection("products")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snapshot) => {
        allProducts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        renderProducts();

        requestAnimationFrame(() => {
          setTimeout(() => {
            hideLoader();
          }, 500);
        });
      },
      (err) => {
        console.error("Failed to load products:", err);
        emptyState.style.display = "block";
        emptyState.textContent =
          "Couldn't load the catalog right now. Please try again shortly.";
      },
    );
  /* ==========================================================
     12. FIREBASE LOGIN & REGISTER (single, unified auth system)
  ========================================================== */
  const authModal = document.getElementById("authModal");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const closeAuthModalBtn = document.getElementById("closeAuthModal");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const guestAuthActions = document.getElementById("guestAuthActions");
  const userAccountActions = document.getElementById("userAccountActions");
  const userGreeting = document.getElementById("userGreeting");
  const logoutBtn = document.getElementById("logoutBtn");

  const bottomNavAccount = document.getElementById("bottomNavAccount");
  // const bottomNavHome = document.getElementById("bottomNavHome");

  const bottomNavAccountLabel = document.getElementById(
    "bottomNavAccountLabel",
  );
  const bottomNavCategoriesBtn = document.getElementById("bottomNavCategories");
  const bottomNavCartBtn = document.getElementById("bottomNavCart");
  const bottomNavHomeBtn = document.getElementById("bottomNavHome");
  const trigger = document.getElementById("loadTrigger");

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;

      const filtered = getFilteredProducts();

      if (visibleCount >= filtered.length) return;

      visibleCount += PAGE_SIZE;

      renderProducts();
    },
    {
      rootMargin: "600px",
    },
  );

  observer.observe(trigger);

  let currentUser = null;

  function switchAuthTab(tab) {
    const showRegister = tab === "register";
    if (loginTab) loginTab.classList.toggle("active", !showRegister);
    if (registerTab) registerTab.classList.toggle("active", showRegister);
    if (loginForm) loginForm.style.display = showRegister ? "none" : "flex";
    if (registerForm)
      registerForm.style.display = showRegister ? "flex" : "none";
  }

  function openAuthModal(tab) {
    if (!authModal) return;
    switchAuthTab(tab || "login");
    authModal.classList.add("open");
    document.body.classList.add("modal-open");
  }

  function closeAuth() {
    if (!authModal) return;
    authModal.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  if (loginBtn)
    loginBtn.addEventListener("click", () => openAuthModal("login"));
  if (registerBtn)
    registerBtn.addEventListener("click", () => openAuthModal("register"));
  if (closeAuthModalBtn) closeAuthModalBtn.addEventListener("click", closeAuth);
  if (loginTab)
    loginTab.addEventListener("click", () => switchAuthTab("login"));
  if (registerTab)
    registerTab.addEventListener("click", () => switchAuthTab("register"));
  if (authModal) {
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) closeAuth();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      authModal &&
      authModal.classList.contains("open")
    ) {
      closeAuth();
    }
  });

  if (bottomNavHomeBtn) {
    bottomNavHomeBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }

  if (bottomNavCategoriesBtn) {
    bottomNavCategoriesBtn.addEventListener("click", () => {
      const filterRow = document.getElementById("filterRow");

      if (filterRow) {
        filterRow.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }

  if (bottomNavCartBtn) {
    bottomNavCartBtn.addEventListener("click", () => {
      openCart();
    });
  }

  if (bottomNavAccount) {
    bottomNavAccount.addEventListener("click", () => {
      if (currentUser) {
        if (confirm("Log out of your account?")) {
          logoutUser();
        }
      } else {
        openAuthModal("login");
      }
    });
  }
  // function friendlyAuthError(error) {
  //   const map = {
  //     "auth/email-already-in-use":
  //       "That email is already registered — try logging in instead.",
  //     "auth/invalid-email": "That doesn't look like a valid email address.",
  //     "auth/weak-password": "Password should be at least 6 characters.",
  //     "auth/user-not-found": "No account found with that email.",
  //     "auth/wrong-password": "Incorrect password. Please try again.",
  //     "auth/too-many-requests":
  //       "Too many attempts — please wait a moment and try again.",
  //     "auth/missing-email": "Please enter your email address first.",
  //   };
  //   return map[error.code] || error.message;
  // }
  function friendlyAuthError(error) {
    const map = {
      "auth/invalid-credential": "Incorrect email or password.",

      "auth/email-already-in-use":
        "That email is already registered. Please login instead.",

      "auth/invalid-email": "Please enter a valid email address.",

      "auth/weak-password": "Password must be at least 6 characters.",

      "auth/user-not-found": "No account found with this email.",

      "auth/wrong-password": "Incorrect password.",

      "auth/too-many-requests":
        "Too many login attempts. Please try again after a few minutes.",

      "auth/missing-email": "Please enter your email address.",

      "auth/network-request-failed":
        "No internet connection. Please check your network.",

      "auth/internal-error": "Something went wrong. Please try again.",
    };

    return map[error.code] || "Something went wrong. Please try again.";
  }
  function showAuthError(message, type = "login") {
    const errorBox = document.getElementById(
      type === "register" ? "registerAuthError" : "authError",
    );

    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.classList.add("show");
  }

  function clearAuthError() {
    const loginError = document.getElementById("authError");
    const registerError = document.getElementById("registerAuthError");

    if (loginError) {
      loginError.textContent = "";
      loginError.classList.remove("show");
    }

    if (registerError) {
      registerError.textContent = "";
      registerError.classList.remove("show");
    }
  }

  // Disables a submit button and swaps its label while an async submit is
  // in flight, restoring it afterward either way.
  async function withButtonSpinner(form, busyLabel, fn) {
    const btn = form.querySelector('button[type="submit"]');
    const original = btn ? btn.textContent : null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = busyLabel;
    }
    try {
      await fn();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = original;
      }
    }
  }

  function setGuestOrUserHeaderUI(user) {
    // if (user) {
    //   if (userGreeting)

    //   if (guestAuthActions) guestAuthActions.classList.add("is-hidden");
    //   if (userAccountActions) userAccountActions.classList.remove("is-hidden");
    //   if (bottomNavAccountLabel) bottomNavAccountLabel.textContent = "Account";
    // } else {
    //   if (guestAuthActions) guestAuthActions.classList.remove("is-hidden");
    //   if (userAccountActions) userAccountActions.classList.add("is-hidden");
    //   if (bottomNavAccountLabel) bottomNavAccountLabel.textContent = "Login";
    // }
    if (user) {
      // Hide Login & Register
      if (guestAuthActions) guestAuthActions.classList.add("is-hidden");

      // Show Logout only
      if (userAccountActions) userAccountActions.classList.remove("is-hidden");

      // Don't show Welcome or Email
      if (userGreeting) userGreeting.style.display = "none";

      // Bottom Navigation
      if (bottomNavAccountLabel) bottomNavAccountLabel.textContent = "Logout";
    } else {
      // Show Login & Register
      if (guestAuthActions) guestAuthActions.classList.remove("is-hidden");

      // Hide Logout
      if (userAccountActions) userAccountActions.classList.add("is-hidden");

      // Bottom Navigation
      if (bottomNavAccountLabel) bottomNavAccountLabel.textContent = "Login";
    }
  }

  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      clearAuthError();
      const name = document.getElementById("registerName").value.trim();
      const email = document.getElementById("registerEmail").value.trim();
      const phoneEl = document.getElementById("registerPhone");
      const phone = phoneEl ? phoneEl.value.trim() : "";
      const password = document.getElementById("registerPassword").value;
      const confirm = document.getElementById("confirmPassword").value;

      if (password !== confirm) {
        showAuthError("Passwords do not match.", "register");
        return;
      }
      if (password.length < 6) {
        showAuthError("Password should be at least 6 characters.", "register");
        return;
      }

      withButtonSpinner(registerForm, "Creating account…", async () => {
        try {
          const userCredential = await auth.createUserWithEmailAndPassword(
            email,
            password,
          );

          const profile = {
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          };
          if (phone) profile.phone = phone;

          await db
            .collection("users")
            .doc(userCredential.user.uid)
            .set(profile);

          showAuthError("Registration successful! Please login.", "register");
          switchAuthTab("login");
        } catch (error) {
          showAuthError(friendlyAuthError(error), "register");
        }
      });
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      withButtonSpinner(loginForm, "Logging in…", async () => {
        try {
          await auth.signInWithEmailAndPassword(email, password);
          closeAuth();
        } catch (error) {
          showAuthError(friendlyAuthError(error), "login");
        }
      });
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", async (e) => {
      e.preventDefault();
      const emailEl = document.getElementById("loginEmail");
      let email = emailEl ? emailEl.value.trim() : "";
      if (!email) {
        email = (
          prompt("Enter your account email to reset your password:") || ""
        ).trim();
      }
      if (!email) return;

      try {
        await auth.sendPasswordResetEmail(email);
        showAuthError(
          "Password reset email sent. Please check your inbox.",
          "login",
        );
      } catch (error) {
        alert(friendlyAuthError(error));
      }
    });
  }

  function logoutUser() {
    auth.signOut();
  }
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  async function loadUserCart() {
    if (!currentUser) return;

    const snapshot = await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("cart")
      .get();

    cart = [];
    snapshot.forEach((doc) => {
      cart.push(doc.data());
    });

    renderCartUI();
    //  renderProducts(); 
  }

  auth.onAuthStateChanged(async function (user) {
    currentUser = user || null;

    setGuestOrUserHeaderUI(currentUser);

    // ---------- Bottom Navigation ----------
    if (bottomNavAccount) {
      const text = bottomNavAccount.querySelector("span");
      const icon = bottomNavAccount.querySelector("i");

      if (currentUser) {
        text.textContent = "Logout";
        icon.className = "fa-solid fa-right-from-bracket";
      } else {
        text.textContent = "Login";
        icon.className = "fa-solid fa-user";
      }
    }

    // ---------- More Menu ----------
    if (moreLoginBtn) {
      if (currentUser) {
        moreLoginBtn.innerHTML = `
                <i class="fa-solid fa-right-from-bracket"></i>
                Logout
            `;
      } else {
        moreLoginBtn.innerHTML = `
                <i class="fa-solid fa-right-to-bracket"></i>
                Login
            `;
      }
    }

    if (currentUser) {
      await loadUserCart();
      if (pendingCart) {
    await addToCart(
        pendingCart.product,
        pendingCart.qty,
        pendingCart.color
    );

    pendingCart = null;
}
    } else {
      cart = [];

      renderCartUI();
       renderProducts();
    }

    listenToUserOrders();
  });

  if (navMore) {
    navMore.addEventListener("click", () => {
      moreMenu.classList.add("show");
      moreMenuOverlay.classList.add("show");
    });
  }

  if (moreMenuOverlay) {
    moreMenuOverlay.addEventListener("click", () => {
      moreMenu.classList.remove("show");
      moreMenuOverlay.classList.remove("show");
    });
  }

  if (moreLoginBtn) {
    moreLoginBtn.addEventListener("click", () => {
      moreMenu.classList.remove("show");
      moreMenuOverlay.classList.remove("show");

      if (currentUser) {
        if (confirm("Log out of your account?")) {
          logoutUser();
        }
      } else {
        openAuthModal("login");
      }
    });
  }
  let loadingMore = false;

  window.addEventListener("scroll", () => {
    if (loadingMore) return;

    const scrollBottom = window.innerHeight + window.scrollY;

    const pageBottom = document.documentElement.scrollHeight - 1200;

    if (scrollBottom >= pageBottom) {
      loadingMore = true;

      if (visibleCount < getFilteredProducts().length) {
        visibleCount += PAGE_SIZE;

        renderProducts();
      }

      setTimeout(() => {
        loadingMore = false;
      }, 300);
    }
  });

  // ==============================
  // Checkout modal
  // ==============================
  const openCheckoutBtn = document.getElementById('openCheckoutBtn');
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutOverlay = document.getElementById('checkoutOverlay');
  const checkoutCloseBtn = document.getElementById('checkoutCloseBtn');
  const addressToggleBtn = document.getElementById('addressToggleBtn');
  const addressForm = document.getElementById('addressForm');

  if (openCheckoutBtn && checkoutModal) {
    openCheckoutBtn.addEventListener('click', () => {
      

      const total = cart.reduce((sum, item) => {
        return sum + (Number(item.price || 0) * Number(item.qty || 0));
      }, 0);

      if (total < 100) {
        alert('Minimum order value is ₹100.');
        return;
      }

      checkoutModal.classList.add('show');
      document.body.style.overflow = 'hidden';
    });
  }

  function closeCheckoutModal() {
    checkoutModal.classList.remove('show');
    document.body.style.overflow = '';
  }

  checkoutCloseBtn?.addEventListener('click', closeCheckoutModal);
  checkoutOverlay?.addEventListener('click', closeCheckoutModal);

  addressToggleBtn?.addEventListener('click', () => {
    addressForm.classList.toggle('hidden');

    const expanded = !addressForm.classList.contains('hidden');

    addressToggleBtn.innerHTML = expanded
      ? '<i class="fa-solid fa-location-dot"></i> Hide Delivery Address'
      : '<i class="fa-solid fa-location-dot"></i> Add Delivery Address';
  });
  // ==============================
// Continue to WhatsApp
// ==============================
// const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');

cartCheckoutBtn?.addEventListener('click', async () => {

  const name = document.getElementById('cartGuestName').value.trim();
const phone = document.getElementById('cartGuestPhone').value.trim();

if (!name) {
  alert('Please enter your name.');
  return;
}

if (!phone) {
  alert('Please enter your phone number.');
  return;
}

// ==============================
// Cart total
// ==============================
const total = cart.reduce((sum, item) => {
  return sum + (Number(item.price || 0) * Number(item.qty || 0));
}, 0);

if (total < 100) {
  alert('Minimum order value is ₹100.');
  return;
}

// ==============================
// Address fields
// ==============================
const house = document.getElementById('guestHouse')?.value.trim() || '';
const street = document.getElementById('guestStreet')?.value.trim() || '';
const area = document.getElementById('guestArea')?.value.trim() || '';
const pincode = document.getElementById('guestPincode')?.value.trim() || '';
const landmark = document.getElementById('guestLandmark')?.value.trim() || '';

if (!area) {
  alert('Please enter your delivery area/city.');
  return;
}

// ==============================
// Order ID + Date + Time
// ==============================
const now = new Date();

const orderId =
  'ZW-' +
  now.getFullYear() +
  String(now.getMonth() + 1).padStart(2, '0') +
  String(now.getDate()).padStart(2, '0') +
  '-' +
  Math.floor(Math.random() * 9000 + 1000);

const orderDate = now.toLocaleDateString('en-IN');

const orderTime = now.toLocaleTimeString('en-IN', {
  hour: '2-digit',
  minute: '2-digit'
});

// ==============================
// WhatsApp message
// ==============================
let message = `🛒 *ZENVEERA WORLD - NEW ORDER*%0A%0A`;

message += `📅 Date: ${orderDate}%0A`;
message += `🕒 Time: ${orderTime}%0A`;
message += `🆔 Order ID: ${orderId}%0A%0A`;

message += `━━━━━━━━━━━━━━━%0A%0A`;

message += `👤 *Customer Details*%0A`;
message += `Name: ${name}%0A`;
message += `Phone: ${phone}%0A%0A`;

message += `📍 *Delivery Address*%0A`;

if (house) message += `House/Flat: ${house}%0A`;
if (street) message += `Street/Society: ${street}%0A`;
if (area) message += `Area/City: ${area}%0A`;
if (pincode) message += `Pincode: ${pincode}%0A`;
if (landmark) message += `Landmark: ${landmark}%0A`;

message += `%0A━━━━━━━━━━━━━━━%0A%0A`;

message += `📦 *Order Items*%0A`;

cart.forEach((item, index) => {
  const lineTotal = Number(item.price || 0) * Number(item.qty || 0);

  message += `%0A${index + 1}️⃣ *${item.name}*%0A`;
  message += `Qty: ${item.qty}%0A`;
  message += `Price: ₹${item.price}%0A`;

  if (item.color) {
    message += `Color: ${item.color}%0A`;
  }

  message += `Subtotal: ₹${lineTotal}%0A`;

  if (item.imageUrl) {
    message += `🔗 Image: ${item.imageUrl}%0A`;
  }
});

message += `%0A━━━━━━━━━━━━━━━%0A%0A`;

message += `🧾 Items: ${cart.length}%0A`;
message += `💰 *Total Amount: ₹${total}*%0A%0A`;

message += `🚚 Free home delivery in *Vavol only*%0A`;
message += `💳 *Prepaid orders only* (COD not available)%0A`;
message += `🛍️ Minimum order ₹100%0A%0A`;

message += `📞 *Zenveera World*%0A`;
message += `+91 7990818211%0A`;
message += `https://www.instagram.com/zenveeraworld%0A%0A`;

message += `🙏 Thank you for shopping with *Zenveera World*!`;

// ==============================
// Save order, then open WhatsApp
// ==============================
try {
  await db.collection('orders').doc(orderId).set({
    orderId: orderId,
    userId: currentUser ? currentUser.uid : null,
    customerName: name,
    phone: phone,
    address: {
      house,
      street,
      area,
      pincode,
      landmark
    },
    items: cart,
    total: total,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
} catch (err) {
  // WhatsApp is still the source of truth for the order itself, so we
  // don't block checkout on this — but the customer won't see it under
  // "My Orders" until the Firestore rules/index issue is fixed.
  console.error('Could not save order for tracking:', err);
}

const whatsappNumber = '917990818211';
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

window.open(whatsappUrl, '_blank');

// Order placed — empty the cart now.
await clearCart();

closeCheckoutModal();
});
})();
const goToRegister = document.getElementById("goToRegister");

if (goToRegister) {
  goToRegister.addEventListener("click", function (e) {
    e.preventDefault();

    // Hide Login Form
    document.getElementById("loginForm").style.display = "none";

    // Show Register Form
    document.getElementById("registerForm").style.display = "block";
  });
}

function setupPasswordToggle(inputId, iconId) {
  const input = document.getElementById(inputId);

  const icon = document.getElementById(iconId);

  if (!input || !icon) return;

  icon.addEventListener("click", () => {
    if (input.type === "password") {
      input.type = "text";

      icon.classList.remove("fa-eye");

      icon.classList.add("fa-eye-slash");
    } else {
      input.type = "password";

      icon.classList.remove("fa-eye-slash");

      icon.classList.add("fa-eye");
    }
  });
}

setupPasswordToggle("loginPassword", "toggleLoginPassword");

setupPasswordToggle("registerPassword", "toggleRegisterPassword");

setupPasswordToggle("confirmPassword", "toggleConfirmPassword");
/* ==========================================
   MOBILE MORE MENU
========================================== */

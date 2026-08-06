(function () {
  "use strict";

  /* ==========================================================
     1. FIREBASE AUTH SETUP
  ========================================================== */
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  const CLOUD_NAME = "xbqatgeh";
  const UPLOAD_PRESET = "zenveera_upload";

  /* ==========================================================
     2. DOM REFERENCES (login screen)
  ========================================================== */
  const loginScreen = document.getElementById("loginScreen");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const loginBtn = document.getElementById("loginBtn");
  const adminSearch = document.getElementById("adminSearch");

  if (adminSearch) {
    adminSearch.addEventListener("input", function () {
      searchText = this.value.toLowerCase().trim();
      renderTable();
    });
  }

  /* ==========================================================
     3. AUTH STATE / LOGIN / LOGOUT
  ========================================================== */
  auth.onAuthStateChanged((user) => {
    if (user) {
      loginScreen.style.display = "none";
      dashboard.style.display = "block";
      subscribeToProducts();
    } else {
      loginScreen.style.display = "flex";
      dashboard.style.display = "none";
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.remove("show");
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    await auth
      .signInWithEmailAndPassword(email, password)
      .catch((err) => {
        loginError.textContent =
          "Sign in failed. Check your Admin ID and password and try again.";
        loginError.classList.add("show");
      })
      .finally(() => {
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in";
      });
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (confirm("Are you sure you want to logout?")) {
      await auth.signOut();
    }
  });

  /* ==========================================================
     4. PRODUCT STATE + FIRESTORE SUBSCRIPTION
  ========================================================== */
  let unsubscribe = null;
  let products = [];
  const downloadCatalogBtn = document.getElementById("downloadCatalogBtn");

  if (downloadCatalogBtn) {
    downloadCatalogBtn.addEventListener("click", downloadCatalog);
  }
  let searchText = "";

  function subscribeToProducts() {
    if (unsubscribe) {
      unsubscribe();
    }

    unsubscribe = db
      .collection("products")
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          products = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          renderTable();
        },
        (error) => {
          console.error(error);
        },
      );
  }

  /* ========================================================== 
     5. CATEGORY FILTER CHIPS (static list, matches Add Product form)
  ========================================================== */
  const CATEGORIES = [
    "Home & Kitchen",
    "Water Bottles & Tumblers",
    "Lunch & Food Storage",
    "Cleaning Supplies",
    "Storage & Organization",
    "Bathroom Accessories",
    "Home Utility",
    "Laundry & Drying",
    "Travel Accessories",
    "Toys & Kids",
    "Stationery & Office",
    "Gifts & Decor",
    "Lighting",
    "Tools & Hardware",
    "Fitness & Sports",
    "Monsoon Essentials",
    "Festival & Seasonal",
    "Other",
  ];
  let currentCategory = "all";

  function renderCategoryChips() {
    const slider = document.getElementById("categorySlider");
    if (!slider) return;

    slider.innerHTML = "";

    CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-chip";
      btn.dataset.category = cat;
      btn.textContent = cat;

      if (cat === currentCategory) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        currentCategory = cat;
        document
          .querySelectorAll(".category-chip")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderTable();
      });

      slider.appendChild(btn);
    });
  }

  const allCategoryBtn = document.querySelector(
    '#categoryToolbar .category-chip[data-category="all"]',
  );

  if (allCategoryBtn) {
    allCategoryBtn.addEventListener("click", () => {
      currentCategory = "all";
      document
        .querySelectorAll(".category-chip")
        .forEach((b) => b.classList.remove("active"));
      allCategoryBtn.classList.add("active");
      renderTable();
    });
  }

  renderCategoryChips();

  /* ==========================================================
     6. HELPERS
  ========================================================== */
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

  /* ==========================================================
     7. RENDER PRODUCT TABLE
  ========================================================== */
  function renderTable() {
    const tbody = document.getElementById("productsTableBody");
    const emptyState = document.getElementById("emptyState");
    const productCount = document.getElementById("productCount");

    const filteredProducts = products.filter((p) => {
      const matchSearch =
        (p.name || "").toLowerCase().includes(searchText) ||
        (p.category || "").toLowerCase().includes(searchText) ||
        String(p.price || "").includes(searchText);

      const matchCategory =
        currentCategory === "all" || p.category === currentCategory;

      return matchSearch && matchCategory;
    });

    if (productCount) {
      productCount.textContent = filteredProducts.length + " Products";
    }

    tbody.innerHTML = "";

    if (!filteredProducts.length) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    filteredProducts.forEach((product) => {
      let qtyClass = "good";
      if (product.quantity <= 5) qtyClass = "low";
      if (product.quantity <= 0) qtyClass = "out";

      const colorsHtml = (product.colors || [])
        .map(
          (c) => `
            <span
              class="color-dot"
              style="background:${c.hex || c};"
              title="${escapeHtml(c.name || "")}"
            ></span>
          `,
        )
        .join("");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <img class="table-image" src="${product.imageUrl || ""}" alt="">
        </td>
        <td>
          <div class="product-name">${escapeHtml(product.name)}</div>
        </td>
        <td>
          <span class="category-badge">${escapeHtml(product.category || "—")}</span>
        </td>
        <td class="price">₹${product.price}</td>
        <td>
          <div class="color-list">${colorsHtml || "—"}</div>
        </td>
        <td>
          <span class="qty ${qtyClass}">${product.quantity ?? 0}</span>
        </td>
        <td>
          <span class="status ${product.inStock ? "in" : "out"}">
            ${product.inStock ? "In Stock" : "Out of Stock"}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-edit" data-action="edit" data-id="${product.id}">
              Edit
            </button>
            <button class="btn-delete" data-action="delete" data-id="${product.id}">
              Delete
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  /* ==========================================================
     8. TABLE ACTIONS (Edit / Delete) — event delegation
     Buttons carry data-action + data-id, this single listener
     handles clicks instead of using inline onclick="" (which
     can't see variables/functions inside this closure).
  ========================================================== */
  document
    .getElementById("productsTableBody")
    .addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const id = btn.dataset.id;
      const product = products.find((p) => p.id === id);
      if (!product) return;

      if (btn.dataset.action === "edit") {
        openForm(product);
      } else if (btn.dataset.action === "delete") {
        if (confirm(`Delete "${product.name}"? This can't be undone.`)) {
          db.collection("products").doc(id).delete();
        }
      }
    });

  /* ==========================================================
     9. ADD / EDIT PRODUCT FORM (modal)
  ========================================================== */
  const formModal = document.getElementById("productFormModal");
  const productForm = document.getElementById("productForm");
  const formError = document.getElementById("formError");
  const colorRows = document.getElementById("colorRows");

  function showModal() {
    // Class toggle (in case css/style.css styles .open) plus an
    // inline-style fallback, so the modal reliably shows even if
    // that class isn't defined anywhere.
    formModal.classList.add("open");
    formModal.style.display = "flex";
  }

  function hideModal() {
    formModal.classList.remove("open");
    formModal.style.display = "none";
  }

  function openForm(product) {
    formError.classList.remove("show");
    productForm.reset();
    colorRows.innerHTML = "";
    document.getElementById("uploadStatus").textContent = "";
    selectedImage = null;

    if (product) {
      document.getElementById("formTitle").textContent = "Edit product";
      document.getElementById("fId").value = product.id;
      document.getElementById("fName").value = product.name || "";
      document.getElementById("fQuantity").value = product.quantity ?? 1;
      document.getElementById("fCategory").value = product.category || "";
      // document.getElementById("fPrice").value = product.price || "";
      document.getElementById("fPrice").value =
        product.originalPrice || product.price || "";

      document.getElementById("fOnSale").checked = product.onSale || false;

      document.getElementById("fDiscountPrice").value =
        product.discountPrice || "";

      document.getElementById("discountPriceField").style.display =
        product.onSale ? "block" : "none";
      document.getElementById("fDesc").value = product.description || "";
      document.getElementById("fImageUrl").value = product.imageUrl || "";
      document.getElementById("fInStock").checked = product.inStock !== false;
      // (product.colors || []).forEach((c) => addColorRow(c.name, c.hex));
      (product.colors || []).forEach((c) => addColorRow(c));
    } else {
      document.getElementById("formTitle").textContent = "Add product";
      document.getElementById("fId").value = "";
      document.getElementById("fQuantity").value = 1;
      document.getElementById("fInStock").checked = true;
    }

    showModal();
  }

  document
    .getElementById("addProductBtn")
    .addEventListener("click", () => openForm(null));

  document.getElementById("formCloseBtn").addEventListener("click", hideModal);

  formModal.addEventListener("click", (e) => {
    if (e.target === formModal) hideModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && formModal.classList.contains("open")) {
      hideModal();
    }
  });

  /* ==========================================================
     10. COLOR ROWS (dynamic add/remove inside the form)
  ========================================================== */
  // function addColorRow(name = "", hex = "#2f6f5e") {
  //   const row = document.createElement("div");
  //   row.className = "color-input-row";
  //   row.innerHTML = `
  //     <input type="color" value="${hex}" class="color-hex" />
  //     <input type="text" placeholder="Color name (e.g. Navy Blue)" value="${escapeHtml(name)}" class="color-name" />
  //     <button type="button" class="remove-color-btn" aria-label="Remove color">×</button>
  //   `;
  //   row
  //     .querySelector(".remove-color-btn")
  //     .addEventListener("click", () => row.remove());
  //   colorRows.appendChild(row);
  // }

  // function addColorRow(color = {}) {
  //   const row = document.createElement("div");

  //   row.className = "color-input-row";

  //   row.innerHTML = `

  //     <input
  //         type="color"
  //         class="color-hex"
  //         value="${color.hex || "#000000"}"
  //     >

  //     <input
  //         type="text"
  //         class="color-name"
  //         placeholder="Color Name"
  //         value="${color.name || ""}"
  //     >

  //     <input
  //         type="file"
  //         class="color-image"
  //         accept="image/*"
  //     >

  //     <button
  //         type="button"
  //         class="remove-color-btn"
  //     >
  //         ×
  //     </button>

  // `;

  //   row
  //     .querySelector(".remove-color-btn")
  //     .addEventListener("click", () => row.remove());

  //   colorRows.appendChild(row);
  // }

  function addColorRow(color = {}) {
    const row = document.createElement("div");

    row.className = "color-input-row";

    row.innerHTML = `

        <input
            type="color"
            class="color-hex"
            value="${color.hex || "#000000"}"
        >

        <input
            type="text"
            class="color-name"
            placeholder="Color Name"
            value="${color.name || ""}"
        >

        <input
            type="file"
            class="color-image"
            accept="image/*"
        >

        <img
            class="color-preview"
            src="${color.imageUrl || ""}"
            style="
                width:70px;
                height:70px;
                object-fit:cover;
                border-radius:10px;
                display:${color.imageUrl ? "block" : "none"};
            "
        >

        <button
            type="button"
            class="remove-color-btn"
        >
            ×
        </button>

    `;

    const fileInput = row.querySelector(".color-image");

    const preview = row.querySelector(".color-preview");

    fileInput.addEventListener("change", function () {
      if (!this.files.length) return;

      preview.src = URL.createObjectURL(this.files[0]);

      preview.style.display = "block";
    });

    row
      .querySelector(".remove-color-btn")
      .addEventListener("click", () => row.remove());

    colorRows.appendChild(row);
  }
  document
    .getElementById("addColorBtn")
    .addEventListener("click", () => addColorRow());

  /* ==========================================================
     11. IMAGE UPLOAD (Cloudinary — no Firebase Storage)
  ========================================================== */
  let selectedImage = null;

  document.getElementById("fImageFile").addEventListener("change", (e) => {
    selectedImage = e.target.files[0];
    if (selectedImage) {
      document.getElementById("uploadStatus").textContent = "Image selected.";
    }
  });

  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error.message);
    }

    return data.secure_url;
  }

  /* ==========================================================
     12. SAVE PRODUCT (create / update in Firestore)
  ========================================================== */
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.classList.remove("show");
    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const id = document.getElementById("fId").value;

      // const colors = Array.from(colorRows.querySelectorAll(".color-input-row"))
      //   .map((row) => ({
      //     name: row.querySelector(".color-name").value.trim(),
      //     hex: row.querySelector(".color-hex").value,
      //   }))
      //   .filter((c) => c.name);
      const colors = [];

      const colorRowsList = Array.from(
        colorRows.querySelectorAll(".color-input-row"),
      );

      for (const row of colorRowsList) {
        const name = row.querySelector(".color-name").value.trim();

        if (!name) continue;

        const hex = row.querySelector(".color-hex").value;

        let imageUrl = "";

        const file = row.querySelector(".color-image").files[0];

        if (file) {
          imageUrl = await uploadToCloudinary(file);
        }

        colors.push({
          name,

          hex,

          imageUrl,
        });
      }

      let imageUrl = document.getElementById("fImageUrl").value;

      if (selectedImage) {
        document.getElementById("uploadStatus").textContent =
          "Uploading image...";
        imageUrl = await uploadToCloudinary(selectedImage);
        document.getElementById("uploadStatus").textContent = "Upload Complete";
      }

      // const quantity = Number(document.getElementById("fQuantity").value);

      // const data = {
      //   name: document.getElementById("fName").value.trim(),
      //   category: document.getElementById("fCategory").value,
      //   price: Number(document.getElementById("fPrice").value),
      //   quantity: quantity,
      //   description: document.getElementById("fDesc").value.trim(),
      //   imageUrl: imageUrl,
      //   colors: colors,
      //   inStock: quantity > 0,
      // };

      const quantity = Number(document.getElementById("fQuantity").value);

      const originalPrice = Number(document.getElementById("fPrice").value);

      const onSale = document.getElementById("fOnSale").checked;

      const discountPrice = Number(
        document.getElementById("fDiscountPrice").value || 0,
      );

      const data = {
        name: document.getElementById("fName").value.trim(),

        category: document.getElementById("fCategory").value,

        price: onSale ? discountPrice : originalPrice,

        originalPrice: originalPrice,

        discountPrice: onSale ? discountPrice : null,

        onSale: onSale,

        quantity: quantity,

        description: document.getElementById("fDesc").value.trim(),

        imageUrl: imageUrl,

        colors: colors,

        inStock: quantity > 0,
      };
      console.log("Product Data:", data);
      console.log("Product ID:", id);
      console.log("Selected Image:", selectedImage);
      console.log("Image URL:", imageUrl);

      if (id) {
        console.log("Updating Product...");

        await db.collection("products").doc(id).update(data);

        console.log("Product Updated Successfully");
      } else {
        console.log("Adding New Product...");

        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

        const docRef = await db.collection("products").add(data);

        // console.log("Product Added Successfully");
        console.log("Document ID:", docRef.id);
      }

      hideModal();

      productForm.reset();

      colorRows.innerHTML = "";

      document.getElementById("fId").value = "";
      document.getElementById("fOnSale").checked = false;

      document.getElementById("fDiscountPrice").value = "";

      document.getElementById("discountPriceField").style.display = "none";
    } catch (err) {
      console.error("========== SAVE ERROR ==========");
      console.error(err);
      console.error("Error Code:", err.code);
      console.error("Error Message:", err.message);

      formError.textContent = err.message;
      formError.classList.add("show");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Product";

      selectedImage = null;

      document.getElementById("fImageFile").value = "";

      document.getElementById("uploadStatus").textContent = "";
    }
  });

  // async function downloadCatalog() {

  //     const { jsPDF } = window.jspdf;

  //     const doc = new jsPDF("p", "mm", "a4");

  //     // ==========================
  //     // HEADER
  //     // ==========================
  //     doc.setFont("helvetica", "bold");
  //     doc.setFontSize(22);
  //     doc.text("ZENVEERA WORLD", 105, 18, { align: "center" });

  //     doc.setFont("helvetica", "normal");
  //     doc.setFontSize(11);
  //     doc.text("Good Choice For You", 105, 25, { align: "center" });

  //     doc.setDrawColor(255, 120, 0);
  //     doc.setLineWidth(0.5);
  //     doc.line(20, 30, 190, 30);

  //     let x = 15;
  //     let y = 38;

  //     for (const product of products) {

  //         if (y > 245) {
  //             doc.addPage();

  //             doc.setFont("helvetica", "bold");
  //             doc.setFontSize(22);
  //             doc.text("ZENVEERA WORLD", 105, 18, { align: "center" });

  //             doc.setFont("helvetica", "normal");
  //             doc.setFontSize(11);
  //             doc.text("Good Choice For You", 105, 25, { align: "center" });

  //             doc.setDrawColor(255,120,0);
  //             doc.line(20,30,190,30);

  //             x = 15;
  //             y = 38;
  //         }

  //         // ==========================
  //         // CARD
  //         // ==========================

  //         doc.setFillColor(255,255,255);
  //         doc.setDrawColor(225);
  //         doc.roundedRect(x, y, 82, 88, 5, 5, "FD");

  //         // ==========================
  //         // IMAGE
  //         // ==========================

  //         try {

  //             const img = await loadImage(product.imageUrl);

  //             doc.addImage(
  //                 img,
  //                 "JPEG",
  //                 x + 10,
  //                 y + 6,
  //                 62,
  //                 42
  //             );

  //         } catch (e) {

  //             doc.rect(x + 10, y + 6, 62, 42);

  //         }

  //         // ==========================
  //         // PRODUCT NAME
  //         // ==========================

  //         doc.setFont("helvetica", "bold");
  //         doc.setFontSize(11);

  //         doc.text(
  //             product.name || "",
  //             x + 41,
  //             y + 58,
  //             {
  //                 align: "center",
  //                 maxWidth: 68
  //             }
  //         );

  //         // ==========================
  //         // PRICE
  //         // ==========================

  //         doc.setTextColor(255,102,0);

  //         doc.setFont("helvetica","bold");
  //         doc.setFontSize(13);

  //         doc.text(
  //             "Rs" + product.price,
  //             x + 41,
  //             y + 75,
  //             {
  //                 align:"center"
  //             }
  //         );

  //         doc.setTextColor(0);

  //         // ==========================
  //         // NEXT CARD
  //         // ==========================

  //         if (x < 100) {

  //             x = 108;

  //         } else {

  //             x = 15;
  //             y += 95;

  //         }

  //     }

  //     doc.save("Zenveera_Product_Catalogue.pdf");

  // }
  async function downloadCatalog() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    // ==========================
    // BRAND COLORS
    // ==========================
    const COLOR_BLUE = [31, 43, 80]; // #1f2b50
    const COLOR_ORANGE = [255, 107, 0]; // #ff6b00
    const COLOR_GRAY = [120, 120, 120];
    const COLOR_BORDER = [225, 225, 225];
    const COLOR_BG = [252, 252, 252]; // #fcfcfc

    const PAGE_W = 210;
    const MARGIN = 10;

    // 3 columns x 3 rows = 9 products per page
    const COLS = 3;
    const CARD_W = 59;
    const CARD_H = 70;
    const GAP_X = 6;
    const GAP_Y = 8;

    const IMG_W = 45;
    const IMG_H = 34;

    const HEADER_H = 50;
    const FOOTER_H = 18;

    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // ==========================
    // WATERMARK
    // ==========================
    function drawWatermark() {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.05 }));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(60);
      doc.setTextColor(...COLOR_BLUE);
      doc.text("ZENVEERA WORLD", PAGE_W / 2, 160, {
        align: "center",
        angle: 45,
      });
      doc.restoreGraphicsState();
    }

    // ==========================
    // HEADER
    // ==========================
    function drawHeader() {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(...COLOR_BLUE);
      doc.text("ZENVEERA WORLD", PAGE_W / 2, 16, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_GRAY);
      doc.text("Good Choice For You", PAGE_W / 2, 22, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("PRODUCT CATALOGUE", PAGE_W / 2, 29, { align: "center" });

      doc.setDrawColor(...COLOR_ORANGE);
      doc.setLineWidth(0.6);
      doc.line(MARGIN, 34, PAGE_W - MARGIN, 34);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_GRAY);
      doc.text(`Generated on ${today}`, MARGIN, 40);
      doc.text(`${products.length} Products Available`, PAGE_W - MARGIN, 40, {
        align: "right",
      });

      doc.setTextColor(0, 0, 0);
    }

    // ==========================
    // FOOTER
    // ==========================
    function drawFooter(pageNum, totalPages) {
      const footerY = 297 - FOOTER_H;

      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, footerY, PAGE_W - MARGIN, footerY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_BLUE);
      doc.text("Generated by ZENVEERA WORLD", PAGE_W / 2, footerY + 5, {
        align: "center",
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_GRAY);
      doc.text(
        "+91 7990818211  |  zenveeraworld2511@gmail.com  |  www.zenveeraworld.com",
        PAGE_W / 2,
        footerY + 9,
        { align: "center" },
      );

      doc.setFontSize(7);
      doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W / 2, footerY + 13, {
        align: "center",
      });

      doc.setTextColor(0, 0, 0);
    }

    function newPage() {
      doc.addPage();
      drawWatermark();
      drawHeader();
    }

    // ==========================
    // FIRST PAGE
    // ==========================
    drawWatermark();
    drawHeader();

    let col = 0;
    let x = MARGIN;
    let y = HEADER_H;
    const rowLimit = 297 - FOOTER_H - CARD_H;

    for (const product of products) {
      if (y > rowLimit) {
        newPage();
        col = 0;
        x = MARGIN;
        y = HEADER_H;
      }

      // ==========================
      // CARD
      // ==========================
      doc.setFillColor(...COLOR_BG);
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, CARD_W, CARD_H, 3, 3, "FD");

      const imgX = x + (CARD_W - IMG_W) / 2;
      const imgY = y + 5;

      // ==========================
      // IMAGE (or placeholder)
      // ==========================
      try {
        const img = await loadImage(product.imageUrl);
        doc.addImage(img, "JPEG", imgX, imgY, IMG_W, IMG_H);
      } catch (e) {
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(...COLOR_BORDER);
        doc.rect(imgX, imgY, IMG_W, IMG_H, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...COLOR_GRAY);
        doc.text("NO IMAGE", x + CARD_W / 2, imgY + IMG_H / 2 + 1.5, {
          align: "center",
        });
        doc.setTextColor(0, 0, 0);
      }

      // ==========================
      // PRODUCT NAME (max 2 lines)
      // ==========================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);

      const nameLines = doc
        .splitTextToSize(product.name || "", CARD_W - 6)
        .slice(0, 2);
      doc.text(nameLines, x + CARD_W / 2, y + 46, { align: "center" });

      // ==========================
      // PRICE
      // ==========================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLOR_ORANGE);
      doc.text("Rs." + product.price, x + CARD_W / 2, y + 62, {
        align: "center",
      });
      doc.setTextColor(0, 0, 0);

      // ==========================
      // NEXT CARD POSITION (3 per row)
      // ==========================
      col++;

      if (col < COLS) {
        x += CARD_W + GAP_X;
      } else {
        col = 0;
        x = MARGIN;
        y += CARD_H + GAP_Y;
      }
    }

    // ==========================
    // FOOTERS (added last, once total page count is known)
    // ==========================
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, totalPages);
    }

    doc.save("Zenveera_Product_Catalogue.pdf");
  }

  // function loadImage(url) {

  //     return new Promise((resolve, reject) => {

  //         const img = new Image();

  //         img.crossOrigin = "Anonymous";

  //         img.onload = function () {

  //             const canvas = document.createElement("canvas");

  //             canvas.width = img.width;

  //             canvas.height = img.height;

  //             const ctx = canvas.getContext("2d");

  //             ctx.fillStyle = "#ffffff";
  //             ctx.fillRect(0,0,canvas.width,canvas.height);

  //             ctx.drawImage(img,0,0);

  //             resolve(canvas.toDataURL("image/jpeg",1));

  //         };

  //         img.onerror = reject;

  //         img.src = url;

  //     });

  // }

  function loadImage(url, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      // Prevent one slow/broken image from freezing the whole PDF
      const timer = setTimeout(() => {
        reject(new Error(`Image load timed out: ${url}`));
      }, timeoutMs);

      img.onload = function () {
        clearTimeout(timer);

        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext("2d");

          // White background so transparent PNGs don't turn black in the PDF
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(img, 0, 0);

          // 0.85 quality keeps file size reasonable for catalogues with many products
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch (err) {
          // Canvas can throw a security error if the image isn't CORS-friendly
          reject(err);
        }
      };

      img.onerror = function () {
        clearTimeout(timer);
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = url;
    });
  }
})();

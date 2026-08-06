# Your Catalog Website — Setup Guide

This is a plain website (no monthly software fees) with:
- A homepage that lists your products with photo, price, and colors
- Click a product → see details → "Chat on WhatsApp" or "Call us" button
- Instagram link and a wholesale note in the footer
- A private **Admin** page (`admin.html`) where you log in with an ID and password to add, edit, price-change, delete, or mark products "out of stock"
- No delivery, cart, or online payment anywhere — it's a catalog, exactly as you wanted

The files are plain HTML/CSS/JavaScript, so they work on almost any web hosting, including basic shared hosting (GoDaddy, Hostinger, etc.), Netlify, Vercel, or GitHub Pages.

The product data (name, price, colors, stock status) is stored in **Firebase** — a free service from Google. This is what lets your admin changes show up on the live site instantly, from any device, without needing a programmer each time. Firebase's free tier is more than enough for a small-to-medium shop catalog.

Total setup time: about 20–25 minutes, one time only.

---

## Step 1 — Create your free Firebase project

1. Go to **https://console.firebase.google.com** and sign in with any Google account.
2. Click **Add project** → give it a name (e.g. "my-shop-catalog") → keep clicking Continue with defaults → **Create project**.
3. Once created, click the **web icon (`</>`)** to add a web app. Give it a nickname (e.g. "Website") → **Register app**.
4. Firebase will show a code block with a `firebaseConfig` object like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "my-shop-catalog.firebaseapp.com",
     projectId: "my-shop-catalog",
     storageBucket: "my-shop-catalog.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
5. Open the file **`js/firebase-config.js`** in this project and copy each value into the matching field. Save the file.

## Step 2 — Turn on the database (Firestore)

1. In the Firebase console left menu, click **Build → Firestore Database** → **Create database**.
2. Choose **Start in production mode** → pick any location close to you → **Enable**.
3. Click the **Rules** tab and replace the contents with this, then click **Publish**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /products/{productId} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```
   This means: anyone can *view* your catalog, but only a **signed-in admin** (you) can *change* it.

## Step 3 — Turn on the admin login (Authentication)

1. In the left menu, click **Build → Authentication** → **Get started**.
2. Under **Sign-in method**, enable **Email/Password**.
3. Go to the **Users** tab → **Add user**. This is where you set your own **Admin ID (email) and password** — it doesn't need to be a real email inbox, just a valid-looking address, e.g. `owner@myshop.com`, with a strong password.
4. Use this exact email + password to log in at `admin.html` on your live site.
   - To change your password later, come back to this Users tab.
   - You can add a second admin user here too, if someone else needs access.

## Step 4 — Turn on image uploads (Storage)

1. In the left menu, click **Build → Storage** → **Get started** → keep defaults → **Done**.
2. Click the **Rules** tab and replace with this, then **Publish**:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /products/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```
   This lets the admin panel upload product photos, and lets customers view them.

That's the Firebase setup done — you won't need to touch the Firebase console again unless you're adding a second admin.

---

## Step 5 — Personalize your site text

Open **`js/site-config.js`** and edit the values (shop name, WhatsApp number, Instagram link, wholesale note). Save the file. You do **not** need to touch any other file to update this info later.

---

## Step 6 — Try it locally (optional but recommended)

Before uploading, you can preview the site on your own computer:
- If you have VS Code, install the "Live Server" extension, right-click `index.html` → "Open with Live Server".
- Or simply double-click `index.html` to open it in your browser (some browsers restrict local Firebase calls — Live Server or a real host avoids this).

Log in at `admin.html` with the ID/password from Step 3, add a test product, and confirm it appears on `index.html`.

---

## Step 7 — Upload to your domain

Upload **all files, keeping the folder structure** (`index.html`, `admin.html`, `css/`, `js/`) to your hosting:

- **Shared hosting (Hostinger, GoDaddy, etc.):** Use their File Manager or FTP, and upload everything into the `public_html` folder (or your domain's root folder).
- **Netlify / Vercel:** Drag-and-drop the whole project folder onto their dashboard — done in under a minute, free tier is enough.
- **GitHub Pages:** Push the folder to a GitHub repository and enable Pages in the repo settings.

Once uploaded, your site is live at your domain, e.g. `https://yourshop.com` and the admin panel at `https://yourshop.com/admin.html`.

**Important:** Don't link to or share the `admin.html` page publicly — it's safe because it requires login, but there's no reason to advertise it. Just bookmark it for yourself.

---

## Step 8 — Generate your QR code

Once the site is live at your domain, use any free QR generator (e.g. `https://www.qr-code-generator.com`) with your homepage link, e.g. `https://yourshop.com`. Download and print it for your shop.

---

## Day-to-day use

- **Add a product:** go to `/admin.html`, log in, click **+ Add product**.
- **Change a price:** log in, click **Edit** on the product, update price, **Save**.
- **Mark out of stock:** click **Mark out of stock** on the product row — it stays visible on the site with an "Out of stock" stamp, exactly as you wanted.
- **Bring it back:** click **Mark in stock** again.
- **Remove a product completely:** click **Delete**.

All changes appear on your live site within a second or two — no re-uploading files needed.

---

## About the design

Colors, fonts, and spacing all live in `css/style.css` under the `:root` section at the top, so the whole site can be recolored by changing a handful of values in one place. Once you send me the reference site you liked, I'll update that section to match it.

## Costs

- Hosting: free–a few dollars/month depending on provider (domain registration is separate, which you likely already have).
- Firebase: free tier covers roughly 50,000 catalog views/day and 20,000 writes/day — far more than a small shop catalog needs. You will not be charged unless you far exceed this and explicitly upgrade.

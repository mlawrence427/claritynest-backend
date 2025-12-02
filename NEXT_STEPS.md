# 📋 ClarityNest - Your Complete Setup Checklist

## ✅ Phase 1: Local Development Setup (Do This First!)

### Step 1: Install Required Software

- [ ] **Install Node.js 18+**
  1. Go to https://nodejs.org
  2. Download the LTS version (Windows Installer .msi)
  3. Run the installer, click Next through all prompts
  4. Verify installation: Open Command Prompt and type `node --version`

- [ ] **Install PostgreSQL**
  1. Go to https://www.postgresql.org/download/windows/
  2. Click "Download the installer"
  3. Download the latest version (PostgreSQL 16)
  4. Run the installer:
     - Set a password for postgres user (WRITE THIS DOWN!)
     - Keep default port 5432
     - Check "pgAdmin 4" when asked about components
  5. Finish installation

- [ ] **Install Git** (for deployment later)
  1. Go to https://git-scm.com/download/win
  2. Download and install with default options

- [ ] **Install VS Code** (recommended code editor)
  1. Go to https://code.visualstudio.com
  2. Download and install

---

### Step 2: Create the Database

- [ ] **Open pgAdmin 4** (search in Start Menu)
- [ ] Enter your postgres password when prompted
- [ ] In the left sidebar, expand "Servers" > "PostgreSQL 16"
- [ ] Right-click "Databases" → "Create" → "Database..."
- [ ] Name: `claritynest` → Click "Save"

✅ **Database ready!**

---

### Step 3: Setup the Project

- [ ] **Extract the project**
  1. Extract `claritynest-backend.zip` to a folder (e.g., `C:\Projects\claritynest-backend`)

- [ ] **Open Command Prompt in the project folder**
  1. Open File Explorer
  2. Navigate to `C:\Projects\claritynest-backend`
  3. Click the address bar, type `cmd`, press Enter

- [ ] **Install dependencies**
  ```cmd
  npm install
  ```

- [ ] **Configure environment**
  1. Open the `.env` file in VS Code or Notepad
  2. Change `DB_PASSWORD=password` to your actual postgres password
  3. Save the file

---

### Step 4: Start the Server

- [ ] In Command Prompt, run:
  ```cmd
  npm run dev
  ```

- [ ] You should see:
  ```
  ✅ Database connection established successfully.
  ✅ Database synchronized successfully.
  
  🌿 ClarityNest Backend Started
     API:    http://localhost:3000/api
     Admin:  http://localhost:3000/admin
  ```

- [ ] **Test it!**
  - Open browser: http://localhost:3000 (main app)
  - Open browser: http://localhost:3000/admin (admin panel)
  - Login with: `admin@claritynest.com` / `AdminPassword123!`

🎉 **Congratulations! Your app is running locally!**

---

## ✅ Phase 2: Setup Stripe Payments

### Step 1: Create Stripe Account

- [ ] Go to https://stripe.com and sign up for free
- [ ] Verify your email

### Step 2: Get API Keys

- [ ] Go to https://dashboard.stripe.com/test/apikeys
- [ ] Copy the **Publishable key** (starts with `pk_test_`)
- [ ] Copy the **Secret key** (starts with `sk_test_`)
- [ ] Paste them in your `.env` file:
  ```
  STRIPE_SECRET_KEY=sk_test_xxxxx
  STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
  ```

### Step 3: Create Products in Stripe

- [ ] Go to https://dashboard.stripe.com/test/products
- [ ] Click "Add product"
- [ ] **Product 1: Monthly Premium**
  - Name: ClarityNest Premium Monthly
  - Price: $9.99
  - Billing period: Monthly
  - Click "Save product"
  - Copy the Price ID (starts with `price_`)
  
- [ ] **Product 2: Yearly Premium**
  - Name: ClarityNest Premium Yearly
  - Price: $79.99
  - Billing period: Yearly
  - Click "Save product"
  - Copy the Price ID

- [ ] Update `.env` with your price IDs:
  ```
  STRIPE_PRICE_MONTHLY=price_xxxxx
  STRIPE_PRICE_YEARLY=price_xxxxx
  ```

### Step 4: Setup Webhook (For Production)

- [ ] Go to https://dashboard.stripe.com/test/webhooks
- [ ] Click "Add endpoint"
- [ ] Endpoint URL: `https://your-domain.com/api/webhook/stripe`
- [ ] Select events:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed
- [ ] Click "Add endpoint"
- [ ] Copy the "Signing secret" (starts with `whsec_`)
- [ ] Add to `.env`:
  ```
  STRIPE_WEBHOOK_SECRET=whsec_xxxxx
  ```

✅ **Stripe payments configured!**

---

## ✅ Phase 3: Deploy Online

### Option A: Deploy to Railway (Easiest - Recommended!)

- [ ] **Push code to GitHub**
  1. Create account at https://github.com
  2. Create new repository named "claritynest-backend"
  3. In Command Prompt:
  ```cmd
  cd C:\Projects\claritynest-backend
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin https://github.com/YOUR_USERNAME/claritynest-backend.git
  git push -u origin main
  ```

- [ ] **Deploy to Railway**
  1. Go to https://railway.app and sign in with GitHub
  2. Click "New Project" → "Deploy from GitHub repo"
  3. Select your claritynest-backend repository
  4. Click "Add variables" and add:
     - All variables from your `.env` file
  5. Click "Add PostgreSQL" from the sidebar
  6. Railway will auto-deploy!

- [ ] **Get your live URL**
  1. Click on your service
  2. Go to Settings → Domains
  3. Generate a domain (e.g., claritynest-backend-production.up.railway.app)

✅ **Your app is now live!**

---

### Option B: Deploy to Render (Also Easy, Has Free Tier)

- [ ] Push code to GitHub (same as above)
- [ ] Go to https://render.com and sign up
- [ ] Click "New" → "Blueprint"
- [ ] Connect your GitHub repository
- [ ] It will auto-detect the `render.yaml` file
- [ ] Set your environment variables
- [ ] Deploy!

---

## ✅ Phase 4: Post-Deployment Checklist

### Update Stripe for Production

- [ ] Update webhook URL to your live domain
- [ ] Update `.env` FRONTEND_URL to your live domain
- [ ] Test a payment with Stripe test cards:
  - Card: 4242 4242 4242 4242
  - Expiry: Any future date
  - CVC: Any 3 digits

### Security Checklist

- [ ] Change ADMIN_PASSWORD in production
- [ ] Generate new JWT_SECRET (use a random string generator)
- [ ] Generate new SESSION_SECRET
- [ ] Enable HTTPS (Railway/Render do this automatically)

### Optional: Custom Domain

- [ ] Buy a domain (Namecheap, Google Domains, etc.)
- [ ] In Railway/Render, add your custom domain
- [ ] Update DNS records as instructed

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "npm not recognized" | Restart Command Prompt after installing Node.js |
| "password authentication failed" | Check DB_PASSWORD in .env matches your postgres password |
| "database does not exist" | Create it in pgAdmin (Step 2) |
| "port 3000 in use" | Close other apps or change PORT in .env |
| Stripe webhook fails | Check webhook URL and secret match |

---

## 📞 Need Help?

1. Check the README.md for API documentation
2. Look at error messages in Command Prompt
3. Search the error message on Google/Stack Overflow

---

## 🎯 Summary: Minimum Steps to Go Live

1. ✅ Install Node.js and PostgreSQL
2. ✅ Create database "claritynest" 
3. ✅ Run `npm install` and `npm run dev`
4. ✅ Create Stripe account and get API keys
5. ✅ Push to GitHub
6. ✅ Deploy to Railway
7. ✅ Add environment variables
8. ✅ Share your live URL! 🎉

**Estimated Time: 1-2 hours for first-time setup**

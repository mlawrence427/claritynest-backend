# 🌿 ClarityNest Backend

A full-stack financial wellness application that tracks your money and emotions together.

## 📁 Project Structure

```
claritynest-backend/
├── src/
│   ├── app.js                 # Main Express application
│   ├── config/
│   │   ├── database.js        # PostgreSQL/Sequelize configuration
│   │   └── auth.js            # JWT & Passport configuration
│   ├── controllers/
│   │   ├── authController.js      # Registration, login, password reset
│   │   ├── accountController.js   # Financial accounts CRUD
│   │   ├── moodController.js      # Emotional check-ins
│   │   ├── communityController.js # Community posts
│   │   ├── adminController.js     # Admin dashboard API
│   │   └── exportController.js    # PDF/CSV/JSON exports
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   └── admin.js           # Admin role verification
│   ├── models/
│   │   ├── index.js           # Model associations
│   │   ├── User.js
│   │   ├── Account.js
│   │   ├── Transaction.js
│   │   ├── Mood.js
│   │   └── Post.js
│   ├── routes/
│   │   ├── auth.js            # /api/auth
│   │   ├── accounts.js        # /api/accounts
│   │   ├── moods.js           # /api/moods
│   │   ├── community.js       # /api/community
│   │   ├── export.js          # /api/export
│   │   ├── admin.js           # /api/admin
│   │   └── adminPanel.js      # /admin (server-rendered)
│   ├── utils/
│   │   ├── email.js           # Password reset emails
│   │   └── pdf.js             # PDF report generation
│   └── views/
│       └── admin/             # EJS templates for admin panel
├── public/
│   └── index.html             # Frontend application
├── .env.example               # Environment variables template
├── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### 1. Clone and Install

```bash
cd claritynest-backend
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE claritynest;

-- Create user (optional)
CREATE USER claritynest_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE claritynest TO claritynest_user;
```

### 3. Environment Configuration

```bash
# Copy example env file
cp .env.example .env

# Edit with your settings
nano .env
```

Required environment variables:

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=claritynest
DB_USER=postgres
DB_PASSWORD=your_password

# Authentication
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d
SESSION_SECRET=another-secret-for-sessions

# Admin account (created on first run)
ADMIN_EMAIL=admin@claritynest.com
ADMIN_PASSWORD=AdminPassword123!
```

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **API**: http://localhost:3000/api

## 📚 API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login and get tokens |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/auth/me` | Get current user profile |
| PATCH | `/api/auth/me` | Update profile |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List all accounts |
| GET | `/api/accounts/:id` | Get account details |
| POST | `/api/accounts` | Create account |
| PATCH | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account |
| POST | `/api/accounts/:id/transactions` | Add transaction |
| GET | `/api/accounts/:id/transactions` | List transactions |

### Moods

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/moods` | List mood entries |
| GET | `/api/moods/analytics` | Get mood analytics |
| GET | `/api/moods/tags` | Get available tags |
| POST | `/api/moods` | Log new mood |
| PATCH | `/api/moods/:id` | Update mood entry |
| DELETE | `/api/moods/:id` | Delete mood entry |

### Community

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/community/posts` | List community posts |
| POST | `/api/community/posts` | Create new post |
| POST | `/api/community/posts/:id/like` | Like/unlike post |
| DELETE | `/api/community/posts/:id` | Delete own post |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/json` | Download JSON backup |
| GET | `/api/export/csv` | Download CSV export |
| GET | `/api/export/pdf` | Download PDF report |
| POST | `/api/export/import` | Import from backup |

### Admin (requires admin role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/users/:id` | Get user details |
| PATCH | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |

## 🗄️ Database Schema

### Users
- id (UUID, PK)
- email (unique)
- password (hashed)
- name
- role (user/premium/admin)
- isActive
- isPremium
- premiumExpiresAt
- lastLoginAt
- preferences (JSONB)

### Accounts
- id (UUID, PK)
- userId (FK)
- name
- type (Cash/Savings/Investment/Retirement/Crypto/Debt)
- balance (decimal)
- currency
- institution
- isArchived

### Transactions
- id (UUID, PK)
- accountId (FK)
- userId (FK)
- type (deposit/withdrawal/interest/expense/transfer)
- amount (decimal)
- note
- category
- transactionDate
- balanceAfter

### Moods
- id (UUID, PK)
- userId (FK)
- value (1-10)
- tags (array)
- note
- netWorthSnapshot
- checkinDate

### Posts
- id (UUID, PK)
- userId (FK)
- content
- likes
- isAnonymous
- isApproved
- isFlagged
- category

## 🔐 Security Features

1. **Password Security**
   - bcrypt hashing (12 rounds)
   - Minimum 8 characters required
   - Password reset via email token

2. **Authentication**
   - JWT access tokens (7 days)
   - Refresh tokens (30 days)
   - Session-based auth for admin panel

3. **Rate Limiting**
   - 100 requests/15 min for API
   - 10 requests/15 min for auth endpoints

4. **Data Protection**
   - CORS configured
   - Helmet security headers
   - Input validation with express-validator

## 🚢 Deployment

### Option 1: Railway/Render/Heroku

1. Push code to GitHub
2. Connect repository to platform
3. Set environment variables
4. Add PostgreSQL addon
5. Deploy

### Option 2: VPS (DigitalOcean, AWS EC2)

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Clone and setup
git clone your-repo
cd claritynest-backend
npm install --production

# Use PM2 for process management
npm install -g pm2
pm2 start src/app.js --name claritynest
pm2 save
pm2 startup
```

### Option 3: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]
```

## 💡 Future Improvements

### Features
- [ ] Plaid integration for bank sync
- [ ] Stripe integration for premium subscriptions
- [ ] Two-factor authentication
- [ ] Mobile app (React Native)
- [ ] Investment tracking with real-time prices
- [ ] Budget categories and alerts
- [ ] Financial goal tracking
- [ ] AI-powered insights

### Technical
- [ ] Redis caching
- [ ] WebSocket for real-time updates
- [ ] Database migrations with Sequelize CLI
- [ ] Unit and integration tests
- [ ] CI/CD pipeline
- [ ] API rate limiting per user
- [ ] Audit logging

## 📄 License

MIT License - feel free to use this for your own projects!

---

Built with ❤️ for financial wellness
"# claritynest-backend" 

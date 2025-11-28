// server.js
require('dotenv').config();
const express = require('express');
const expressLayouts = require("express-ejs-layouts");
const session = require('express-session');
const cookieParser = require('cookie-parser'); // ADD THIS
const JwtAuthExpress = require('jwt-auth-express-tidb-cloud');
const sendMail = require("./api/emailService.js");

const cors = require('cors');
const path = require("path");

const app = express();

// Middleware
app.use(cors());

// ADD COOKIE PARSER - This is crucial for reading cookies
app.use(cookieParser());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Layout setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layouts/application");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const routes = require("./routes/routes.js");

// Custom validation middleware
const requestLogger = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
};

async function startServer() {
  // Initialize auth with UI enabled
  const auth = await JwtAuthExpress.create({
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    database: {
      host: process.env.TIDB_HOST,
      database: process.env.TIDB_DATABASE,
      username: process.env.TIDB_USERNAME,
      password: process.env.TIDB_PASSWORD
    },
    basePath: '/o/auth', // Customize path
    enableUI: true     // Enable built-in UI
  });

  // This automatically sets up both API and UI routes!
  auth.setupApp(app);

  // IMPORTANT: Use the auth middleware to bind user to request
  // This should come AFTER auth setup but BEFORE your routes
  app.use(auth.getOptionalAuthMiddleware()); // This binds user to req.user if token exists

  // Make user available to all views - FIXED VERSION
  app.use((req, res, next) => {
    // req.user is now available from the auth middleware
    res.locals.user = req.user || null;
    console.log('🔐 User in request:', req.user); // Debug log
    next();
  });

  // Your application routes
  app.use("/", routes);
  app.post("/api/send-email", sendMail);

  app.listen(3000, () => {
    console.log('Server running on port 3000');
    console.log('Authentication UI: http://localhost:3000/o/auth/signin');
    console.log('Homepage: http://localhost:3000/');
  });
}

startServer();
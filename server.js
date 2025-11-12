const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const app = express();

const routes = require("./routes/routes.js");
// Layout setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(expressLayouts);
// Set Layout
app.set("layout", "layouts/application");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index", {
    title: "Convify"
  });
});

app.use("/", routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Convify running on http://localhost:${PORT}`));

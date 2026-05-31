import app from "./app.js";

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`SEO report app is running at http://localhost:${PORT}`);
});


const url = "https://script.google.com/macros/s/AKfycbxVsox-8LZPittUTxf6rG8q-FKy7YGtuM9s_cjOvN92gvCF0iDRws1lYaeGDw9bACla/exec";
const payload = JSON.stringify({
  category: "test",
  feedback: "Testing from Node.js",
  userEmail: "test@example.com",
  userName: "Test User",
  timestamp: new Date().toISOString()
});

fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "text/plain;charset=utf-8"
  },
  body: payload
}).then(res => {
  console.log("Status:", res.status);
  return res.text();
}).then(text => {
  console.log("Response:", text);
}).catch(err => {
  console.error("Error:", err);
});

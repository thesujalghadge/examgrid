import fetch from "node-fetch";

async function testApiPublish() {
  const url = "http://localhost:3000/api/institute/ddcc7407-fbb6-42bd-9751-576ef43e2241/tests/d18c20cf-7c4b-455c-b2b5-098e0919ebac/publish";
  console.log(`Hitting ${url}`);
  try {
    const res = await fetch(url, { method: "POST" });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
  } catch (e: any) {
    console.error("Fetch error:", e.message);
  }
}

testApiPublish();

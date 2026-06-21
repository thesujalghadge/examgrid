import fetch from "node-fetch";

async function run() {
  const examId = "test-legacy-001"; // Simulating a non-UUID legacy ID
  const instituteId = "ddcc7407-fbb6-42bd-9751-576ef43e2241";

  const url = `http://localhost:3000/api/institute/${instituteId}/tests/${examId}/publish`;
  try {
    const res = await fetch(url, { method: "POST" });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
  } catch (e: any) {
    console.error("Fetch error:", e.message);
  }
}

run().catch(console.error);

const { getInstituteGeminiKey } = require("../src/lib/institute/get-institute-api-key");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function listModels() {
  const key = await getInstituteGeminiKey(process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID || "ddcc7407-fbb6-42bd-9751-576ef43e2241");
  console.log("Key length:", key ? key.length : "no key");
  try {
     const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + key);
     const data = await response.json();
     if (data.models) {
         data.models.forEach((m: any) => console.log(m.name));
     } else {
         console.log(data);
     }
  } catch (e) {
     console.error(e);
  }
}
listModels();

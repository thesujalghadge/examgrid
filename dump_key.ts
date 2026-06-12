import { getInstituteGeminiKey } from "./src/lib/institute/get-institute-api-key";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const key = await getInstituteGeminiKey(process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID as string);
  console.log("THE_KEY_IS:", key);
}

main().catch(console.error);

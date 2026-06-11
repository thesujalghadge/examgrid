import fs from "fs";
let content = fs.readFileSync("src/types/cbt-paper-processing.ts", "utf-8");
content = content.replace('| "gemini_vision";', '| "gemini_vision"\n    | "vision_crop";');
fs.writeFileSync("src/types/cbt-paper-processing.ts", content);
console.log("Updated cbt-paper-processing.ts");

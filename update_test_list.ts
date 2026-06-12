import fs from "fs";

let content = fs.readFileSync("src/components/student/student-cbt-test-list.tsx", "utf-8");

const oldCode = `          {rows.map(({ test, schedule, status, hasSubmitted, hasInProgress }) => {
            const active = status === "active";
            const ctaLabel = hasSubmitted
              ? "View result"
              : hasInProgress
                ? "Resume test"
                : "Start test";`;

const newCode = `          {rows.map(({ test, schedule, status, hasSubmitted, hasInProgress }) => {
            const startLimit = new Date(schedule.startAt).getTime() + 10 * 60 * 1000;
            const isLate = Date.now() > startLimit;
            const missed = status === "active" && !hasSubmitted && !hasInProgress && isLate;
            const active = status === "active" && !missed;
            
            const ctaLabel = hasSubmitted
              ? "View result"
              : hasInProgress
                ? "Resume test"
                : "Start test";`;

content = content.replace(oldCode.replace(/\r\n/g, '\n'), newCode);
content = content.replace(oldCode, newCode);

const oldStatusDisplay = `                    <span className="capitalize">{status}</span>`;
const newStatusDisplay = `                    <span className="capitalize">{missed ? "Missed" : status}</span>`;
content = content.replace(oldStatusDisplay, newStatusDisplay);

const oldRenderAction = `                  ) : status === "upcoming" ? (
                    <span className="text-sm text-[#5e5a52]">
                      Opens{" "}
                      {new Date(schedule.startAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  ) : (
                    <span className="text-sm text-[#5e5a52]">Window closed</span>
                  )}`;

const newRenderAction = `                  ) : missed ? (
                    <span className="text-sm text-red-500 font-medium">
                      Missed (joined more than 10 mins late)
                    </span>
                  ) : status === "upcoming" ? (
                    <span className="text-sm text-[#5e5a52]">
                      Opens{" "}
                      {new Date(schedule.startAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  ) : (
                    <span className="text-sm text-[#5e5a52]">Window closed</span>
                  )}`;

content = content.replace(oldRenderAction.replace(/\r\n/g, '\n'), newRenderAction);
content = content.replace(oldRenderAction, newRenderAction);

fs.writeFileSync("src/components/student/student-cbt-test-list.tsx", content);
console.log("updated test list");

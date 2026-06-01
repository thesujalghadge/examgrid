const fs = require('fs');

// Fix students/page.tsx
let pagePath = 'src/app/institute/students/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(
  'await awaitRepositoryPersist();',
  'try { await awaitRepositoryPersist(); } catch (err) { alert(`Failed to save student: ${err.message || err.code}`); return; }'
);
fs.writeFileSync(pagePath, page);

// Fix QuestionCard.tsx
let qPath = 'src/components/exam/QuestionCard.tsx';
let q = fs.readFileSync(qPath, 'utf8');

// Replace the span wrapping the option text
let target = `<span
                        className={cn(
                          "flex-1 whitespace-pre-wrap break-words text-sm leading-6",
                          isSelected && !isTeacherEdit ? "text-white" : "text-gray-950",
                        )}
                      >
                        <span
                          className={cn(
                            "mr-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                            isSelected && !isTeacherEdit
                              ? "border-white bg-white text-[#1a3c6e]"
                              : "border-[#1a3c6e] bg-white text-[#1a3c6e]",
                          )}
                        >
                          {opt.label}
                        </span>
                        {isTeacherEdit ? (
                          <input
                            className="w-[calc(100%-2.5rem)] rounded-md border border-[#d7dde7] px-2 py-1 text-sm"
                            value={opt.text}
                            onChange={(event) => review?.onOptionTextChange?.(opt.label, event.target.value)}
                          />
                        ) : (
                          <MathRenderer text={displayOptionText} className="text-sm leading-6" />
                        )}
                      </span>`;

let replacement = `<div
                        className={cn(
                          "flex flex-1 items-center gap-3 whitespace-pre-wrap break-words text-sm leading-6",
                          isSelected && !isTeacherEdit ? "text-white" : "text-gray-950",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                            isSelected && !isTeacherEdit
                              ? "border-white bg-white text-[#1a3c6e]"
                              : "border-[#1a3c6e] bg-white text-[#1a3c6e]",
                          )}
                        >
                          {opt.label}
                        </span>
                        <div className="flex-1">
                          {isTeacherEdit ? (
                            <input
                              className="w-full rounded-md border border-[#d7dde7] px-2 py-1 text-sm"
                              value={opt.text}
                              onChange={(event) => review?.onOptionTextChange?.(opt.label, event.target.value)}
                            />
                          ) : (
                            <MathRenderer text={displayOptionText} className="text-sm leading-6" />
                          )}
                        </div>
                      </div>`;

// Since it has Windows CRLF, replace using regex that ignores line endings:
target = target.replace(/\r\n/g, '\n');
q = q.replace(/\r\n/g, '\n');
q = q.replace(target, replacement);

fs.writeFileSync(qPath, q);
console.log('Done');

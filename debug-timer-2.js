const fs = require('fs');
let code = fs.readFileSync('c:/AI/examgrid/src/app/api/cbt/test-session/submit/route.ts', 'utf8');
code = code.replace(
  'return NextResponse.json({ error: "Invalid timer session", timer, bodyTestId: body.testId, bodySessionId: body.sessionId, bodyUserId: ws.userId }, { status: 403 });',
  'return NextResponse.json({ error: "Invalid timer session", timerRaw }, { status: 403 });'
);
fs.writeFileSync('c:/AI/examgrid/src/app/api/cbt/test-session/submit/route.ts', code);

const fs = require('fs');

async function testApi() {
  const fileBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), 'dummy.pdf');
  
  console.log("Sending request to parse-paper API...");
  const res = await fetch('http://localhost:3000/api/institute/test-inst/parse-paper', {
    method: 'POST',
    body: formData,
    headers: {
      'cookie': 'mock-auth=true'
    }
  });
  
  if (!res.ok) {
    console.error("API failed:", await res.text());
    return;
  }
  
  const data = await res.json();
  console.log(`Received ${data.questions?.length} questions.`);
  
  // Verify first question
  const q1 = data.questions[0];
  console.log("Q1 ID:", q1.id);
  console.log("Q1 Images:", q1.images);
  console.log("Q1 Options length:", q1.options?.length);
  
  // Count questions with images
  const withImages = data.questions.filter(q => q.hasImage).length;
  console.log(`Questions with images: ${withImages}`);
  
  console.log("Done.");
}

testApi().catch(console.error);

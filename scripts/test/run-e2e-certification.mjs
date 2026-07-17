import fetch from 'node-fetch';

async function run() {
  const instituteId = "11111111-1111-1111-1111-111111111111"; // Standard test institute

  const papers = [];
  for (let i = 1; i <= 3; i++) {
    const questions = [];
    const answerKey = [];
    for (let j = 1; j <= 75; j++) {
      questions.push({ type: 'MCQ_SINGLE', text: `Paper ${i} Question ${j}`, options: [{id:'A',label:'A',text:'A'}, {id:'B',label:'B',text:'B'}, {id:'C',label:'C',text:'C'}, {id:'D',label:'D',text:'D'}] });
      answerKey.push('A'); // All answers A for simplicity
    }
    
    const students = [];
    for (let s = 1; s <= 5; s++) {
      // Create a student personality:
      // s=1: perfect
      // s=2: all wrong
      // s=3: 50/50
      // s=4: skipped half
      // s=5: random
      const answers = [];
      for (let j = 1; j <= 75; j++) {
        if (s === 1) answers.push('A');
        else if (s === 2) answers.push('B');
        else if (s === 3) answers.push(j % 2 === 0 ? 'A' : 'B');
        else if (s === 4) answers.push(j > 37 ? null : 'A');
        else answers.push(['A','B','C','D', null][Math.floor(Math.random() * 5)]);
      }
      students.push({
        name: `Student Personality ${s}`,
        answers
      });
    }

    papers.push({
      title: `JEE Mock Paper ${i}`,
      questions,
      answerKey,
      students
    });
  }

  console.log("Sending dataset to Production Validation Harness...");
  const res = await fetch('http://localhost:3000/api/internal/dev/import-e2e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instituteId, papers })
  });

  let json;
  try {
    json = await res.clone().json();
  } catch (e) {
    console.error("Failed to parse JSON. Response text:");
    console.error(await res.text());
    process.exit(1);
  }

  console.log("JSON response received.");

  if (!res.ok) {
    console.error("Harness failed:", json);
    process.exit(1);
  }

  console.log("\n================ PRODUCTION CERTIFICATION ================\n");
  const cert = json.certification;
  
  if (!cert) {
    console.error("No certification payload found in response.");
    console.log(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  for (const [key, val] of Object.entries(cert)) {
    if (key === 'Details' && Object.keys(val).length === 0) continue;
    if (key === 'Details') {
      console.log(`\n--- Details ---`);
      for (const [dkey, dval] of Object.entries(val)) {
        console.log(`${dkey}: ${dval}`);
      }
    } else {
      console.log(`${key.padEnd(25, ' ')} : ${val}`);
    }
  }
}

run().catch(console.error);

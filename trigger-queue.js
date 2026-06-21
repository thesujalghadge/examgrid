async function main() {
  let totalProcessed = 0;
  while (true) {
    try {
      const res = await fetch('http://localhost:3000/api/internal/process-solution-queue', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer dev-secret'
        }
      });
      const data = await res.json();
      console.log('Processed in this batch:', data.jobsProcessed);
      if (data.results) {
        data.results.forEach((r, i) => {
          console.log(`  Result ${i+1}: ${r.success ? 'SUCCESS' : 'FAILED'} - ${r.reason || r.status || ''}`);
        });
      }
      
      if (!data.jobsProcessed || data.jobsProcessed === 0) {
        console.log('Queue empty or all processed. Exiting.');
        break;
      }
      totalProcessed += data.jobsProcessed;
      
      // small delay just in case
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error('Fetch error:', e);
      break;
    }
  }
  console.log('Total Processed:', totalProcessed);
}
main();

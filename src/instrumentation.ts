export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runVerification } = await import('./instrumentation-node');
    await runVerification();
  }
}


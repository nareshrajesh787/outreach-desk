// Run fn over items with at most `size` running at once.
export async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  const q = [...items];
  await Promise.all(Array.from({ length: Math.min(size, q.length) }, async () => {
    while (q.length) { const x = q.shift()!; await fn(x); }
  }));
}

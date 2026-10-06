// Stop scheduling on error, but keep the UI locked until every started task settles.
export async function runLimited<T>(items: readonly T[], concurrency: number,
  task: (item: T, index: number) => Promise<void>): Promise<void> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Invalid concurrency");
  let next = 0;
  let failed = false;
  let firstError: unknown;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try { await task(items[index], index); }
      catch (error) { if (!failed) firstError = error; failed = true; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  if (failed) throw firstError;
}

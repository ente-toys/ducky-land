// Synchronous callers use the same algorithm without a scheduling budget.
export function finishWork(steps) {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}

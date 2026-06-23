/**
 * FIFO request queue — limits concurrent API calls to prevent thundering-herd bursts on page load (NFR1.5).
 */

type Task<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

const MAX_CONCURRENT = 4;

let active = 0;
const pending: Task<unknown>[] = [];

function drain() {
  while (active < MAX_CONCURRENT && pending.length > 0) {
    const task = pending.shift()!;
    active += 1;
    task
      .run()
      .then(task.resolve, task.reject)
      .finally(() => {
        active -= 1;
        drain();
      });
  }
}

/** Enqueue an async task; runs when a queue slot is available. */
export function enqueueRequest<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pending.push({ run, resolve: resolve as (value: unknown) => void, reject });
    drain();
  });
}

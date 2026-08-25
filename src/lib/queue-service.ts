export type QueueStatus = 'Waiting' | 'Now Serving' | 'Completed';

export type QueueSnapshot = {
  queueNumber: string;
  estimatedWaitMinutes: number | null;
  status: QueueStatus;
  lastUpdated: string;
  source: 'demo' | 'live';
  peopleAhead?: number | null;
  currentServingNumber?: number | null;
  appointment?: {
    date: string;
    time: string;
    doctorName?: string;
    clinic?: string;
  } | null;
};

type ServerQueue = {
  queueNumber?: string | number;
  estimatedWaitMinutes?: number | null;
  status?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  ahead?: number | null;
  currentServingNumber?: number | null;
  appointment?: {
    date?: string;
    time?: string;
    doctorName?: string;
    clinic?: string;
  } | null;
} | null | undefined;

/**
 * Queue provider seam:
 * - The demo provider below is used until the queue system is production-ready.
 * - Set VITE_QUEUE_MODE=live to consume the authenticated API response instead.
 * Replacing this provider does not require changes to the Home page widget.
 */
const QUEUE_MODE = import.meta.env.VITE_QUEUE_MODE === 'live' ? 'live' : 'demo';
const DEMO_STORAGE_PREFIX = 'sugbodoc_demo_queue:';
let inMemoryDemo: QueueSnapshot | null = null;

function getDemoStorageKey() {
  try {
    const user = JSON.parse(localStorage.getItem('sugbodoc_user') ?? 'null') as { id?: string; email?: string } | null;
    return `${DEMO_STORAGE_PREFIX}${user?.id ?? user?.email ?? 'current-session'}`;
  } catch {
    return `${DEMO_STORAGE_PREFIX}current-session`;
  }
}

function randomInt(min: number, max: number) {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return min + (values[0] % (max - min + 1));
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createDemoQueueSnapshot(): QueueSnapshot {
  const prefixes = ['A', 'B', 'Q', 'N', 'C'];
  return {
    queueNumber: `${prefixes[randomInt(0, prefixes.length - 1)]}-${String(randomInt(1, 999)).padStart(3, '0')}`,
    estimatedWaitMinutes: randomInt(10, 45),
    status: 'Waiting',
    lastUpdated: new Date().toISOString(),
    source: 'demo',
    peopleAhead: randomInt(2, 12),
    appointment: {
      date: 'Today',
      time: '9:00 AM',
      doctorName: 'Clinic appointment',
      clinic: 'SugboDoc Regional Hospital',
    },
  };
}

function getDemoQueueSnapshot(): QueueSnapshot {
  if (inMemoryDemo) return inMemoryDemo;
  const key = getDemoStorageKey();
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as QueueSnapshot;
      if (parsed.source === 'demo' && parsed.queueNumber && parsed.lastUpdated) {
        inMemoryDemo = parsed;
        return parsed;
      }
    }
    const created = createDemoQueueSnapshot();
    sessionStorage.setItem(key, JSON.stringify(created));
    inMemoryDemo = created;
    return created;
  } catch {
    inMemoryDemo ??= createDemoQueueSnapshot();
    return inMemoryDemo;
  }
}

function normalizeLiveQueue(queue: ServerQueue): QueueSnapshot | null {
  if (!queue?.queueNumber) return null;
  const status: QueueStatus =
    queue.status === 'Now Serving' || queue.status === 'Completed' ? queue.status : 'Waiting';
  return {
    queueNumber: String(queue.queueNumber),
    estimatedWaitMinutes: queue.estimatedWaitMinutes ?? null,
    status,
    lastUpdated: queue.updatedAt ?? queue.createdAt ?? new Date().toISOString(),
    source: 'live',
    peopleAhead: queue.ahead ?? null,
    currentServingNumber: queue.currentServingNumber ?? null,
    appointment: queue.appointment?.date && queue.appointment?.time
      ? {
          date: queue.appointment.date,
          time: queue.appointment.time,
          doctorName: queue.appointment.doctorName,
          clinic: queue.appointment.clinic,
        }
      : null,
  };
}

export function getQueueSnapshot(serverQueue?: ServerQueue): QueueSnapshot {
  if (QUEUE_MODE === 'live') {
    return normalizeLiveQueue(serverQueue) ?? getDemoQueueSnapshot();
  }
  return getDemoQueueSnapshot();
}

export function isDemoQueueEnabled() {
  return QUEUE_MODE !== 'live';
}
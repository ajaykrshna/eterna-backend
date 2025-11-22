import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const ORDER_QUEUE_NAME = 'order-execution-queue';

export const orderQueue = new Queue(ORDER_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { MockDexRouter } from '../infrastructure/MockDexRouter';
import { OrderRepository } from '../infrastructure/OrderRepository';
import { ORDER_QUEUE_NAME } from './OrderQueue';
import IORedis from 'ioredis';

const router = new MockDexRouter();
const repo = new OrderRepository();

// Helper to broadcast updates to WebSocket
async function notify(orderId: string, status: string, payload: any) {
  // Create a fresh publisher connection for each notification
  const pub = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
  });
  
  try {
    await repo.updateStatus(orderId, status as any, JSON.stringify(payload), payload.txHash, payload.finalPrice);
    
    const channel = `order-updates:${orderId}`;
    const message = JSON.stringify({ status, ...payload });
    const numSubscribers = await pub.publish(channel, message);
    console.log(`Published to ${channel}: ${message.substring(0, 100)} (${numSubscribers} subscribers)`);
  } finally {
    await pub.quit();
  }
}

export const startWorker = () => {
  const worker = new Worker(
    ORDER_QUEUE_NAME,
    async (job: Job) => {
      const { orderId, tokenIn, tokenOut, amount } = job.data;

      try {
        await notify(orderId, 'routing', { message: 'Fetching quotes...' });
        const quotes = await router.getQuotes(tokenIn, tokenOut, amount);

        // Route to best price automatically
        // Assuming quotes return Amount Out, so higher is better.
        const selectedDex = quotes.raydium > quotes.meteora ? 'raydium' : 'meteora';

        await notify(orderId, 'routing', {
          quotes,
          decision: `Selected ${selectedDex} (Best Liquidity/Price)`
        });

        await notify(orderId, 'building', { message: 'Constructing transaction...' });
        // Simulate build time
        await new Promise(r => setTimeout(r, 500));

        await notify(orderId, 'submitted', { message: 'Sent to Solana network...' });

        const result = await router.executeSwap(selectedDex, orderId);


        await notify(orderId, 'confirmed', {
          txHash: result.txHash,
          finalPrice: result.price,
          message: 'Swap successful'
        });

        return result;

      } catch (error: any) {
        // If attempts exhausted, emit "failed"
        if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
          await notify(orderId, 'failed', { error: error.message });
        }
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 60000,
      },
    }
  );

  console.log('Worker started...');
  return worker;
};

import { FastifyInstance } from 'fastify';
import { orderQueue } from '../services/OrderQueue';
import { redisConnection } from '../config/redis';
import { OrderRepository } from '../infrastructure/OrderRepository';
import { randomUUID } from 'crypto';
import IORedis from 'ioredis';

const repo = new OrderRepository();

export async function routes(fastify: FastifyInstance) {

  // Health Check Endpoint
  fastify.get('/', async (request, reply) => {
    return { message: 'System is running', status: 'ok' };
  });
  
  // POST /api/orders/execute
  fastify.post('/api/orders/execute', {
    schema: {
      tags: ['orders'],
      summary: 'Execute a market order',
      description: 'Submit a market order for execution. Returns an orderId to track the order via WebSocket.',
      body: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amount'],
        properties: {
          tokenIn: {
            type: 'string',
            description: 'Input token symbol or address'
          },
          tokenOut: {
            type: 'string',
            description: 'Output token symbol or address'
          },
          amount: {
            type: 'number',
            description: 'Amount of tokenIn to swap',
            minimum: 0.00000001
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Unique order identifier (UUID)'
            },
            status: {
              type: 'string',
              description: 'Initial order status'
            },
            message: {
              type: 'string'
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { tokenIn, tokenOut, amount } = request.body as any;
    
    // Basic validation
    if (!tokenIn || !tokenOut || !amount) {
      return reply.status(400).send({ 
        error: 'Missing required fields: tokenIn, tokenOut, amount' 
      });
    }
    
    if (tokenIn === tokenOut) {
      return reply.status(400).send({ 
        error: 'tokenIn and tokenOut must be different' 
      });
    }
    
    if (amount <= 0) {
      return reply.status(400).send({ 
        error: 'amount must be greater than 0' 
      });
    }

    const orderId = randomUUID();

    const order = {
      id: orderId,
      type: 'MARKET' as const,
      tokenIn,
      tokenOut,
      amount,
      status: 'pending' as const,
      createdAt: new Date()
    };

    // Persist initial state
    await repo.create(order);

    // Queue the order
    await orderQueue.add('market-order', { ...order, orderId });

    // Return orderId immediately
    return { orderId, status: 'pending', message: 'Order queued. Connect to WebSocket for updates.' };
  });

  // WebSocket Endpoint
  fastify.get('/ws/orders/:orderId', { websocket: true }, async (socket, req) => {
    const { orderId } = req.params as any;
    console.log(`Client connected for order: ${orderId}`);

    // Send initial acknowledgment
    socket.send(JSON.stringify({ 
      status: 'connected', 
      message: `Listening for updates on order ${orderId}` 
    }));

    // Fetch current order status from DB and send it
    try {
      const order = await repo.findById(orderId);
      if (order) {
        socket.send(JSON.stringify({ 
          status: order.status,
          message: 'Current order status',
          txHash: order.txHash,
          executionPrice: order.executionPrice,
          logs: order.logs
        }));
        
        // If order is already in terminal state, close connection
        if (order.status === 'confirmed' || order.status === 'failed') {
          setTimeout(() => {
            socket.close();
          }, 1000);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch order status:', err);
    }

    const subClient = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
      lazyConnect: true 
    });

    // Set up message handler BEFORE subscribing
    subClient.on('message', (channel, message) => {
      console.log(`Received message on channel ${channel}:`, message);
      socket.send(message); // Stream updates to client
      
      try {
        const data = JSON.parse(message);
        // Close connection on terminal states
        if (data.status === 'confirmed' || data.status === 'failed') {
          setTimeout(() => {
            socket.close();
            subClient.quit();
          }, 1000);
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });

    subClient.connect().then(async () => {
      // Subscribe to the specific order channel
      await subClient.subscribe(`order-updates:${orderId}`);
      console.log(`Subscribed to order-updates:${orderId}`);
    }).catch((err) => {
      console.error('Failed to connect subscriber:', err);
      socket.send(JSON.stringify({ status: 'error', message: 'Failed to connect to updates' }));
      socket.close();
    });

    // Cleanup
    socket.on('close', () => {
      console.log(`WebSocket closed for order: ${orderId}`);
      subClient.quit();
    });
  });
}

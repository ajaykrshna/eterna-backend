import 'dotenv/config';
import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import { routes } from './routes';
import { startWorker } from '../services/OrderWorker';

const server = Fastify({ logger: true });

const schema = {
  type: 'object',
  required: ['PORT', 'REDIS_HOST', 'REDIS_PORT'],
  properties: {
    PORT: {
      type: 'number',
      default: 3000
    },
    REDIS_HOST: {
      type: 'string',
      default: 'localhost'
    },
    REDIS_PORT: {
      type: 'number',
      default: 6379
    },
    DATABASE_URL: {
      type: 'string',
      default: ''
    }
  }
};

server.register(fastifyEnv, {
  confKey: 'config',
  schema: schema,
  dotenv: false
});

// Swagger Documentation
server.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Eterna DEX Order API',
      description: 'Real-time order execution API with WebSocket updates for Solana DEX trading',
      version: '1.0.0'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' }
    ],
    tags: [
      { name: 'orders', description: 'Order execution endpoints' }
    ]
  }
});

server.register(fastifySwaggerUI, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true
  },
  staticCSP: true
});

// Fastify + WebSocket support
server.register(websocket);
server.register(routes);

const start = async () => {
  try {
    await server.ready();

    // Start the worker
    startWorker();

    await server.listen({ port: (server as any).config.PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${(server as any).config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

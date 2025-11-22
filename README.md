# Eterna - DEX Order Execution Engine

Order execution engine for Solana DEX trading with real-time WebSocket updates and intelligent routing between Raydium and Meteora.

## Order Type Selection: Market Orders

**Why Market Orders?**
Market orders provide immediate execution at current market prices, demonstrating core routing logic, queue management, and real-time updates without the complexity of price monitoring or timing precision.

**Extension Strategy:**
- **Limit Orders**: Add a price monitoring worker that continuously checks market prices against order targets, triggering execution when conditions are met.
- **Sniper Orders**: Implement event listeners for token launches/migrations, with priority queue handling for time-sensitive execution.

## Technology Stack

- Node.js + TypeScript
- Fastify (API + WebSocket)
- BullMQ + Redis (job queue)
- PostgreSQL (order history)
- Mock DEX implementation

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start Redis:
```bash
redis-server
```

3. Run the application:
```bash
pnpm dev
```

Server runs at `http://localhost:3000`

## API Endpoints

**Swagger UI:** `http://localhost:3000/docs`

**Submit Order:**
```bash
POST /api/orders/execute
{
  "tokenIn": "USDC",
  "tokenOut": "SOL",
  "amount": 12
}
```

**WebSocket Updates:**
```javascript
ws://localhost:3000/ws/orders/{orderId}
```

## Design Decisions

**Mock vs Real DEX Integration**
- Mock implementation with realistic delays focuses on architecture without blockchain complexity
- Easy to extend to real DEX SDKs (drop-in replacement pattern)

**HTTP + WebSocket Pattern**
- Separate POST endpoint for submission, WebSocket for updates
- Enables late WebSocket connections via DB query for current state
- Prevents race conditions between order submission and status updates

**BullMQ for Queue Management**
- Built-in retry logic with exponential backoff
- Concurrency control and rate limiting
- Job persistence and failure tracking

**Database Strategy**
- PostgreSQL for audit log with graceful degradation if unavailable
- Redis for real-time updates, PostgreSQL for history

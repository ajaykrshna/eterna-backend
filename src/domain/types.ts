export type OrderStatus = 
  | 'pending' 
  | 'routing' 
  | 'building' 
  | 'submitted' 
  | 'confirmed' 
  | 'failed';

export interface Order {
  id: string;
  type: 'MARKET';
  tokenIn: string;
  tokenOut: string;
  amount: number;
  status: OrderStatus;
  txHash?: string;
  executionPrice?: number;
  logs?: string[];
  createdAt: Date;
}

// Interface for the Router 
export interface IDexRouter {
  getQuotes(tokenIn: string, tokenOut: string, amount: number): Promise<{
    raydium: number;
    meteora: number;
  }>;
  executeSwap(dex: 'raydium' | 'meteora', orderId: string, executionPrice: number): Promise<{ txHash: string; price: number }>;
}

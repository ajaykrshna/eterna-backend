import { IDexRouter } from "../domain/types";

export class MockDexRouter implements IDexRouter {
  private readonly BASE_PRICE = 100; // Simulated base price

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getQuotes(tokenIn: string, tokenOut: string, amount: number) {
    // Simulate network delay
    await this.sleep(200);

    return {
      raydium: amount * (this.BASE_PRICE * (0.98 + Math.random() * 0.04)),
      meteora: amount * (this.BASE_PRICE * (0.97 + Math.random() * 0.05)),
    };
  }

  async executeSwap(dex: string, orderId: string, executionPrice: number) {
    // Simulate 2-3 second execution
    await this.sleep(2000 + Math.random() * 1000);

    // Random failure simulation for retry logic
    if (Math.random() < 0.1) {
      throw new Error("Simulated RPC Timeout");
    }

    return {
      txHash: `tx_${Math.random().toString(36).substring(7)}`,
      price: executionPrice,
    };
  }
}

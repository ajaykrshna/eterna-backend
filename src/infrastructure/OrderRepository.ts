import { Pool } from 'pg';
import { Order, OrderStatus } from '../domain/types';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || undefined
});

export class OrderRepository {
  async create(order: Order): Promise<void> {
    const query = `
      INSERT INTO orders (id, type, token_in, token_out, amount, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await pool.query(query, [order.id, order.type, order.tokenIn, order.tokenOut, order.amount, order.status, order.createdAt])
      .catch(err => console.warn("DB Write Failed:", err.message));
  }

  async updateStatus(id: string, status: OrderStatus, logs?: string, txHash?: string, price?: number): Promise<void> {
    const query = `
      UPDATE orders 
      SET status = $1, logs = array_append(COALESCE(logs, '{}'), $2), tx_hash = COALESCE($3, tx_hash), execution_price = COALESCE($4, execution_price)
      WHERE id = $5
    `;
    await pool.query(query, [status, logs, txHash, price, id])
      .catch(err => console.warn("DB Update Failed:", err.message));
  }

  async findById(id: string): Promise<Order | null> {
    const query = `
      SELECT id, type, token_in, token_out, amount, status, tx_hash, execution_price, logs, created_at
      FROM orders
      WHERE id = $1
    `;
    try {
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type,
        tokenIn: row.token_in,
        tokenOut: row.token_out,
        amount: row.amount,
        status: row.status,
        txHash: row.tx_hash,
        executionPrice: row.execution_price,
        logs: row.logs,
        createdAt: row.created_at
      };
    } catch (err: any) {
      console.warn("DB Read Failed:", err.message);
      return null;
    }
  }
}

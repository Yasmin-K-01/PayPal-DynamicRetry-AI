import express, { Request, Response } from 'express';
import axios from 'axios';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Database Pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'nisha001',
  database: process.env.DB_NAME|| 'retrywise',
  waitForConnections: true,
  connectionLimit: 10
});
app.get('/', (req: Request, res: Response) => {
  res.send('RetryWise Backend Engine is Live!');
});
// SQL Filtered Logs Endpoint
app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string;
    let query = 'SELECT id, transaction_id, ai_score, decision, executed_at AS created_at FROM retry_logs';
    const params: any[] = [];

    // Filter type-க்கு ஏற்ப SQL WHERE Clause சேர்க்கப்படுகிறது
    if (filter === 'RETRY') {
      query += ' WHERE decision IN (?, ?)';
      params.push('AUTO_RETRY', 'RETRY_NOW');
    } else if (filter === 'DECLINE') {
      query += ' WHERE decision NOT IN (?, ?)';
      params.push('AUTO_RETRY', 'RETRY_NOW');
    }

    query += ' ORDER BY executed_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Database Query Error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});
// PayPal Webhook Receiver & FastAPI Integrator
app.post('/webhooks/paypal', async (req: Request, res: Response) => {
  const event = req.body;
  const resource = event.resource || {};
  const transactionId = resource.id || `TX-${Date.now()}`;
  const failureReason = resource.status_details?.reason || 'TEMPORARY_SYSTEM_ERROR';
  const amount = resource.amount?.value || 49.99;

  try {
    const FASTAPI_BASE_URL = process.env.FASTAPI_URL || 'https://paypal-dynamicretry-ai.onrender.com';
    // 1. Send failure details to Python FastAPI engine for AI Scoring
    const aiRes = await axios.post(`${process.env.FASTAPI_URL}/api/v1/evaluate`, {
      transaction_id: transactionId,
      failure_reason: failureReason,
      previous_recovery: true,
      attempt_count: 1
    });

    
    const { score, decision, breakdown } = aiRes.data;

    // 2. Save evaluation into MySQL transactions & retry_logs table
    await db.execute(
      `INSERT INTO transactions (id, user_id, amount, failure_reason, status) 
       VALUES (?, ?, ?, ?, 'FAILED') 
       ON DUPLICATE KEY UPDATE failure_reason = VALUES(failure_reason)`,
      [transactionId, 'USER_DEMO', amount, failureReason]
    );

    await db.execute(
      `INSERT INTO retry_logs (transaction_id, ai_score, decision, reason_breakdown) 
       VALUES (?, ?, ?, ?)`,
      [transactionId, score, decision, JSON.stringify(breakdown)]
    );

    console.log(`[Success] Tx: ${transactionId} | Score: ${score} | Decision: ${decision}`);
    res.status(200).json({ status: 'SUCCESS', decision, score });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3000, () => console.log('Node Express Server running on http://localhost:3000'));

// Auto-Simulation Mode for Demo Presentation (Triggers every 8 seconds)
setInterval(async () => {
  const fakeTxnId = `TXN_LIVE_${Math.floor(1000 + Math.random() * 9000)}`;
  const fakeReasons = ['INSTRUMENT_DECLINED', 'INSUFFICIENT_FUNDS', 'EXPIRED_CARD', 'NETWORK_TIMEOUT'];
  const fakeReason = fakeReasons[Math.floor(Math.random() * fakeReasons.length)];
  const fakeAmount = (Math.random() * 150 + 10).toFixed(2);

  try {
    await axios.post('http://localhost:3000/webhooks/paypal', {
      id: `WH-SIM-${Date.now()}`,
      resource: {
        id: fakeTxnId,
        amount: { value: fakeAmount },
        status_details: { reason: fakeReason }
      }
    });
    console.log(`[Auto Sim] Simulated failure generated for ${fakeTxnId}`);
  } catch (err) {
    // Ignore log errors
  }
}, 8000);
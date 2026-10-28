// @ts-nocheck
import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface RetryLog {
  id: number;
  transaction_id: string;
  ai_score: number;
  decision: string;
  created_at: string;
}

export default function App() {
  const [logs, setLogs] = useState<RetryLog[]>([]);

  const fetchLogs = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/logs');
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif' }}>
      <h2>RetryWise AI Dashboard</h2>
      <table border={1} cellPadding={10} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Transaction ID</th>
            <th>AI Retry Score</th>
            <th>Decision</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.id}</td>
              <td>{log.transaction_id}</td>
              <td>{log.ai_score}</td>
              <td style={{ color: log.decision === 'RETRY_NOW' ? 'green' : 'red', fontWeight: 'bold' }}>
                {log.decision}
              </td>
              <td>{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
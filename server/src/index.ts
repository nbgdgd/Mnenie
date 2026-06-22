// Точка входа backend Mnenie.
import cors from 'cors';
import express from 'express';
import { api } from './routes/api.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'mnenie-api' }));
app.use('/api', api);

app.listen(PORT, () => {
  console.log(`Mnenie API на http://localhost:${PORT}`);
});

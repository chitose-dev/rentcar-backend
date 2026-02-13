import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root
app.get('/', (_req, res) => {
  res.json({ 
    name: 'トクノリレンタカー API',
    version: '1.0.0',
    status: 'running'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

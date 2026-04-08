import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('OK'));
app.listen(3002, () => console.log('Test server on 3002'));

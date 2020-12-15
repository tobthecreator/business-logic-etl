// Dependencies for Babel
import 'core-js/stable';
import 'regenerator-runtime/runtime';

// App Dependencies
import dotenv from 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';

// Routes
import routes from './routes';

const app = express();
app.use(bodyParser.json());

routes(app);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

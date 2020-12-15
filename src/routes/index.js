import { WorkMinutesController } from '../controllers/work_min_controller';

module.exports = (app) => {
  // Information
  app.get('/', (req, res) => {
    res.send({ service: 'business-logic-etl' });
  });

  // ################
  // # Work Minutes #
  // ################
  app.get('/crons/work-minutes', WorkMinutesController);
  app.post('/crons/work-minutes', WorkMinutesController);
};

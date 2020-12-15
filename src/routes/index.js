import WorkAvailabilityController from '../controllers/work_availability_controller';

module.exports = (app) => {
  // Information
  app.get('/', (req, res) => {
    res.send({ service: 'business-logic-etl' });
  });

  // #####################
  // # Work Availability #
  // #####################
  app.get('/etl/work-availability', WorkAvailabilityController);
  app.post('/etl/work-availability', WorkAvailabilityController);
};

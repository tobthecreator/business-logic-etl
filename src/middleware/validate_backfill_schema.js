import { has } from 'underscore';

const reqHasRequiredParameters = requestBody => {
  // TODO: eventually add in express-validate, or another package
  return has(requestBody, 'startTime') && has(requestBody, 'endTime');
};

const validateBackfillSchema = (req, res, next) => {
  if (reqHasRequiredParameters(req.body)) {
    next();
  } else {
    res.status(400).send({ error: 'Bad request' });
  }
};

export default validateBackfillSchema;

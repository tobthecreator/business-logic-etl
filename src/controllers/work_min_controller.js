import axios from 'axios';
import _ from 'underscore';

const extract = () => {};

const transform = () => {};

const load = () => {};

export const WorkMinutesController = (req, res) => {
  res.status(200).send({ working: true, method: req.method });
};

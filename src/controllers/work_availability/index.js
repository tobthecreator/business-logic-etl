import calculateStartAndEndTimes from '../../helpers/calculate_start_and_end_times';
import composePipeline from '../../helpers/compose_pipeline';
import Extractor from './work_availability_extractor';
import Transformer from './work_availability_transformer';
import Loader from './work_availability_loader';

const WorkAvailabilityController = (req, res) => {
  const { startTime, endTime } = calculateStartAndEndTimes(req, 14, true);
  const workAvailabilityPipeline = composePipeline(Extractor, Transformer, Loader);
  const recordsLogged = workAvailabilityPipeline(startTime, endTime);

  // TODO: add error handling and new status codes
  res.status(200).send({ working: true, method: req.method, recordsLogged: recordsLogged.length });
};

export default WorkAvailabilityController;

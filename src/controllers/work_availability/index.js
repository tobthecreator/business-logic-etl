import calculateStartAndEndTimes from '../../helpers/calculate_start_and_end_times';
import composePipeline from '../../helpers/compose_pipeline';
import Extractor from './work_availability_extractor';
import Transformer from './work_availability_transformer';
import Loader from './work_availability_loader';

/**
 * WorkAvailabilityController
 * @description
 * The Work Availability takes clock-in and clock-out records created by Support Techs
 * and creates and Availability record.  Each Availability record corresponds with
 * our Tech Metrics standard of Email, Date and Hour as primary keys.  For each
 * Email, Date and Hour, Work Availability records provide how many minutes
 * a Tech was clocked-in, and an 60 item array representing each minute where a Tech was
 * clock-in
 */

const WorkAvailabilityController = async (req, res) => {
  // Retrieve startTime and endTime from POST request if it is a backfill
  // Calculate startTime and endTime if it is a GET Cron Request
  // Default cron lookback period is 14 days
  const { startTime, endTime } = calculateStartAndEndTimes(req, 14, true);

  /*
   * Each ETL Pipeline contains one file for the Extractor, Transformer and Loader
   *
   * The Extractor is in charge of requesting the data. This is often done from
   * our own APIs in other services, from endpoints in Zendesk APIs or other
   * apps, or against the database directly.
   *
   * The Transformer is responsible for cleaning the data of irregularities,
   * applying business logic to transform the record, and then applying the required
   * schema necessary to upload it to BigQuery or to the next service
   *
   * The Loader is responsible for sending the data onto it's next
   * location, typically BigQuery.
   */
  const workAvailabilityPipeline = composePipeline(Extractor, Transformer, Loader);
  const recordsLogged = workAvailabilityPipeline(startTime, endTime);

  // TODO: add error handling and new status codes
  res.status(200).send({ working: true, method: req.method, recordsLogged: recordsLogged.length });
};

export default WorkAvailabilityController;

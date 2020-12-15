// import { BigQuery } from '@google-cloud/bigquery';

// Each controller has it's own service account with permissions to only the tables it needs to query and update
// const BQ = new BigQuery({
//   projectId: 'example-project',
//   keyFilename: './example-service-account-for-loader.json',
// });

/**
 * loader
 * @description
 * Take the prefabricated records from the Transformer, and upload them to
 * the Work Availability table in subsets of 10000, the insert upload cap.
 *
 * If errors occur, publish an event to Google PubSub to send a Slack alert
 * and create a follow-up JIRA ticket.
 *
 * Note: Loaders are normally abstracted into a helper function since they
 * only require a link to their Service Account json file and where they
 * are logging
 *
 * @param {Array} records Work Availabilty records matching BQ table schema
 * @return {Array}
 */
const loader = records => {
  // #################################################
  // # Example if GCP Project and BQ Dataset existed #
  // #################################################
  //   const workAvailabilityTable  = BQ.dataset(tech_metrics).table('work_availability');
  //   try {
  //     for (let i = 0; i < records.length; i += 10000) {
  //       const subset = records.slice(i, i + 10000);
  //       await workAvailabilityTable.insert(subset);
  //     }
  //   } catch (e) {
  //     // Normally would kick off an alert to an alert cloud function that pings slack and makes a JIRA ticket
  //     console.log(e);
  //   }
  //
  //   // In larger ETLs, an array of Promises is returned
  //   return records;

  records.forEach(record => console.log(record));
  return records;
};

export default loader;

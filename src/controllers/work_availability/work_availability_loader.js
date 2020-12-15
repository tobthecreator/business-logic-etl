// import { BigQuery } from '@google-cloud/bigquery';

// Each controller has it's own service account with permissions to only the tables it needs to query and update
// const BQ = new BigQuery({
//   projectId: 'example-project',
//   keyFilename: './example-service-account-for-loader.json',
// });

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
  //   return records;

  records.forEach(record => console.log(record));
  return records;
};

export default loader;

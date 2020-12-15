import { readFileSync } from 'fs';
import path from 'path';
// import { BigQuery } from '@google-cloud/bigquery';

// Each controller has it's own service account with permissions to only the tables it needs to query and update
// const BQ = new BigQuery({
//   projectId: 'example-project',
//   keyFilename: './example-service-account-for-extraction.json',
// });

/**
 * queryTimeCardsTableInBigQuery
 * @description
 * Query the time cards table and turn each clock-in and clock-out datetime
 * into a new schema that is easier to parse for our business logic.
 *
 * Each clock-in becomes startDate ("YYYY-MM-DD"), startHour ("YYYY-MM-DD HH:00:00")
 * and startTime ("YYYY-MM-DD HH:MM:SS").  Each clock-out is treated the same,
 * generating endDate ("YYYY-MM-DD"), endHour ("YYYY-MM-DD HH:00:00")
 * and endTime ("YYYY-MM-DD HH:MM:SS").
 *
 * This new schema will be used to break up multi-day and multi-hour records into
 * records that represent the fractoinal timecard for a specific tech, on a specific
 * date, at a specific hour.
 *
 * If errors occur, publish an event to Google PubSub to send a Slack alert
 * and create a follow-up JIRA ticket.
 *
 * Note: I normally add metrics around response time to each of these Extractors, and
 * log those results to a database like BigQuery.  This way I can have metrics
 * on the speed of our services, and monitor for things dramtically outside of range.
 * This has helped us spot a few outages before they were reported to us on several occasions.
 *
 * @param {Array} startTime YYYY-MM-DD, or YYYY-MM-DDTHH:MM:SS, as a string
 * @param {Array} endTime YYYY-MM-DD, or YYYY-MM-DDTHH:MM:SS, as a string
 * @param {Array} pageNum pagination iterator, how far to offset or next query
 * @param {Array} limit size of each page of results
 * @return {Promise}
 */
const queryTimeCardsTableInBigQuery = (startTime, endTime, pageNum, limit = 5000) => {
  const timecardsTable = BQ.dataset('hr').table('timecards_current');

  const queryString = `
          SELECT 
              tc_email as \`email\`,
              date(tc_clock_in_ct) as \`startDate\`,
              FORMAT_DATETIME('%Y-%m-%d %H:00:00', tc_clock_in_ct) AS \`startHour\`,
              tc_clock_in_ct as \`startTime\`,
              CASE 
                  WHEN tc_clock_out_ct IS NULL 
                  THEN current_date()
                  ELSE date(tc_clock_out_ct)
                  END AS \`endDate\`,
              CASE 
                  WHEN tc_clock_out_ct IS NULL 
                  THEN FORMAT_DATETIME('%Y-%m-%d %H:00:00', CURRENT_DATETIME("America/Chicago"))
                  ELSE FORMAT_DATETIME('%Y-%m-%d %H:00:00', tc_clock_out_ct)
                  END AS \`endHour\`,
              CASE 
                  WHEN tc_clock_out_ct IS NULL THEN CURRENT_DATETIME("America/Chicago")
                  ELSE tc_clock_out_ct
                  END AS \`endTime\`,  
          FROM \`example-project.hr.timecards_current\`
          INNER JOIN (SELECT e_email, e_active, e_job from \`hr.employees_current\`) AS e_c 
          ON (e_c.se_email = tc_email AND e_job IN ("L3", "L2", "L1") AND e_active = 1)
          WHERE
              tc_clock_in_ct > CAST(CAST('${startTime}' AS DATE) AS DATETIME) 
              AND tc_clock_in_ct < CAST(DATE_ADD('${endTime}', INTERVAL 1 DAY) AS DATETIME)
              AND tc_clock_in_ct IS NOT NULL
              AND tc_clock_out_ct IS NOT NULL
              AND tc_pay_code = "Regular"
          ${process.env.NODE_ENV === 'dev' ? 'ORDER BY email DESC, startTime DESC' : ''}
          LIMIT ${limit}
          OFFSET ${limit * pageNum}
      `;

  return new Promise((resolve, reject) => {
    timecardsTable.query(queryString, (error, rows) => {
      if (error !== null) {
        reject(error);
      }

      if (rows !== null) {
        resolve({ records: rows });
      }
    });
  });
};

/**
 * extractor
 * @description
 * From BigQuery (in the commented-out code below), make paginated requests for timecard
 * data until no more results are returned.
 *
 * For the example code, synchronously extract the example timecard data I've generated
 * and return it in the same format that BigQuery would
 *
 * @param {String} startTime YYYY-MM-DD, or YYYY-MM-DDTHH:MM:SS, as a string
 * @param {String} endTime YYYY-MM-DD, or YYYY-MM-DDTHH:MM:SS, as a string
 * @return {Array}
 */
const extractor = (startTime, endTime) => {
  // #################################################
  // # Example if GCP Project and BQ Dataset existed #
  // #################################################
  //   let pageNum = 0;
  //   const recordsExtracted = [];
  //   let continueExtracting = true;
  //   while (continueExtracting) {
  //     let queriedRecords;
  //
  //     try {
  //       const queriedRecords = queryTimeCardsTableInBigQuery(startTime, endTime, pageNum);
  //     } catch (error) {
  //       // Normally would kick off an alert to an alert cloud function that pings slack and makes a JIRA ticket
  //       console.log(error);
  //     }
  //
  //     recordsExtracted.push(...queriedRecords);
  //
  //     if (queriedRecords.length === 0) {
  //       continueExtracting = false;
  //     }
  //
  //     pageNum += 1;
  //   }
  //
  // return recordsExtracted

  const jsonBuffer = readFileSync(path.join(__dirname, 'example-timecards-response.json'));
  const records = JSON.parse(jsonBuffer);
  return records;
};

export default extractor;

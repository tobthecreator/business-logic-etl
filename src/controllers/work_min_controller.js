import axios from 'axios';
import _ from 'underscore';
import calculateStartAndEndTimes from '../helpers/calculate_start_and_end_times';
import { readFileSync } from 'fs';
import path from 'path';

// import { BigQuery } from '@google-cloud/bigquery';

// Each controller has it's own service account with permissions to only the tables it needs to query and update
// const BQ = new BigQuery({
//   projectId: 'example-project',
//   keyFilename: './example-service-account.json',
// });

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

const extract = (startTime, endTime) => {
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
  const recordsExtracted = JSON.parse(jsonBuffer);

  return recordsExtracted;
};

const transform = () => {};

const load = () => {};

export const WorkMinutesController = (req, res) => {
  const { startTime, endTime } = calculateStartAndEndTimes(req, 14, true);
  extract(startTime, endTime);
  res.status(200).send({ working: true, method: req.method });
};

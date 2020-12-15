import _ from 'underscore';
import { readFileSync } from 'fs';
import path from 'path';
import calculateStartAndEndTimes from '../helpers/calculate_start_and_end_times';
import composePipeline from '../helpers/compose_pipeline';

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

const cleanupRecords = records => {
  return records.map(record => {
    const { startDate, endDate, startTime, endTime } = record;

    return Object.assign(record, {
      startDate: startDate.value,
      endDate: endDate.value,
      startTime: startTime.value,
      endTime: endTime.value
    });
  });
};

const expandMultiDayRecord = record => {
  const buildStartDateRecord = r => {
    return Object.assign(r, {
      endHour: `${record.startDate}T23:00:00`,
      endTime: `${record.startDate}T23:59:59.999Z`
    });
  };

  const buildEndDateRecord = r => {
    return Object.assign(r, {
      startHour: `${record.endDate}T00:00:00`,
      startTime: `${record.endDate}T00:00:00`
    });
  };

  return [buildStartDateRecord(record), buildEndDateRecord(record)];
};

const expandToDaily = records => {
  const dailyRecords = [];

  records.forEach(record => {
    if (record.startDate !== record.endDate) {
      dailyRecords.push(...expandMultiDayRecord(record));
    } else {
      dailyRecords.push(record);
    }
  });

  return dailyRecords;
};

const expandMultiHourRecord = record => {
  const buildStartHourRecord = r => {
    const { email, startHour, startTime, endHour } = r;

    const startHourDateObject = new Date(startHour);
    const startTimeDateObject = new Date(startTime);
    const startHourDateString = startHourDateObject.toISOString().split('.')[0];

    return {
      email,
      date: startHourDateString.split('T')[0],
      hour: startHourDateString.split('T')[1],
      startMin: startTimeDateObject.getMinutes(),
      endMin: 59
    };
  };
  const buildMiddleHourRecords = r => {
    const { email, startHour, endHour } = r;

    const startHourDateObject = new Date(startHour);
    const endHourDateObject = new Date(endHour);
    const hoursDifference = endHourDateObject.getHours() - startHourDateObject.getHours();

    const outputRecords = [];
    for (let i = 1; i < hoursDifference; i += 1) {
      startHourDateObject.setHours(startHourDateObject.getHours() + 1);
      const startHourDateString = startHourDateObject.toISOString().split('.')[0];
      outputRecords.push({
        email,
        date: startHourDateString.split('T')[0],
        hour: startHourDateString.split('T')[1],
        startMin: 0,
        endMin: 59
      });
    }

    return outputRecords;
  };
  const buildEndHourRecord = r => {
    const { email, endHour, endTime } = r;
    const endHourDateObject = new Date(endHour);
    const endTimeDateObject = new Date(endTime);
    const endHourDateObjectString = endHourDateObject.toISOString().split('.')[0];

    return {
      email,
      date: endHourDateObjectString.split('T')[0],
      hour: endHourDateObjectString.split('T')[1],
      startMin: 0,
      endMin: endTimeDateObject.getMinutes()
    };
  };

  return [
    buildStartHourRecord(record),
    ...buildMiddleHourRecords(record),
    buildEndHourRecord(record)
  ];
};

const expandToHourly = records => {
  const hourlyRecords = [];

  records.forEach(record => {
    if (record.startHour !== record.endHour) {
      hourlyRecords.push(...expandMultiHourRecord(record));
    } else {
      hourlyRecords.push(record);
    }
  });

  return hourlyRecords;
};

const groupRecordsByEmailDateAndHour = records => {
  const outputObj = {};
  const recordsGroupedByEmail = _.groupBy(records, 'email');
  console.log(recordsGroupedByEmail);

  Object.keys(recordsGroupedByEmail).forEach(email => {
    outputObj[email] = _.groupBy(recordsGroupedByEmail[email], 'date');
    delete outputObj[email].undefined;

    Object.keys(outputObj[email]).forEach(date => {
      outputObj[email][date] = _.groupBy(outputObj[email][date], 'hour');
    });
  });

  return outputObj;
};

const createWorkAvailabilityRecord = recordsObj => {
  const workMinuteRecords = [];
  const minutesArrayTemplate = new Array(60).fill(0);

  Object.keys(recordsObj).forEach(email => {
    Object.keys(recordsObj[email]).forEach(date => {
      Object.keys(recordsObj[email][date]).forEach(hour => {
        const workMinutesArray = [...minutesArrayTemplate];

        recordsObj[email][date][hour].forEach(record => {
          const { startMin, endMin } = record;

          for (let i = startMin; i <= endMin; i += 1) {
            workMinutesArray[i] += 1;
          }
        });

        const hourlyObject = {
          email,
          date,
          hour,
          workMinutesSum: workMinutesArray.filter(minute => minute !== 0).length,
          workMinutesArray: workMinutesArray.map(minute => (minute > 1 ? 1 : minute))
        };

        workMinuteRecords.push(hourlyObject);
      });
    });
  });

  return workMinuteRecords;
};

const applyBusinessLogic = records => {
  const businessLogicPipeline = composePipeline(
    expandToDaily,
    expandToHourly,
    groupRecordsByEmailDateAndHour,
    createWorkAvailabilityRecord
  );

  return businessLogicPipeline(records);
};

const prepareForBigQuery = records => {
  return records.map(record => {
    const { email, date, hour, workMinutesSum, workMinutesArray } = record;

    return {
      // Primary Keys
      wa_email: email,
      wa_date: date,
      wa_hour: hour,
      wa_work_minutes_sum: workMinutesSum,
      wa_work_minutes_array: workMinutesArray
    };
  });
};

const transform = records => {
  const transformPipeline = composePipeline(cleanupRecords, applyBusinessLogic, prepareForBigQuery);

  return transformPipeline(records);
};

const load = records => {
  // #################################################
  // # Example if GCP Project and BQ Dataset existed #
  // #################################################
  //   const workAvailabilityTable  = BQ.dataset(process.env.BIGQUERY_DATASET).table('sor_cxapi_work_availability');
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

const WorkAvailabilityController = (req, res) => {
  const { startTime, endTime } = calculateStartAndEndTimes(req, 14, true);
  const workAvailabilityPipeline = composePipeline(extract, transform, load);

  const recordsLogged = workAvailabilityPipeline();

  res.status(200).send({ working: true, method: req.method, recordsLogged: recordsLogged.length });
};

export default WorkAvailabilityController;

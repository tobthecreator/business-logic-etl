import _ from 'underscore';
import composePipeline from '../../helpers/compose_pipeline';

/**
 * cleanupRecords
 * @description
 * Simplify the record schema, since it comes out BigQuery with extra key:value pairs
 * that we don't need.
 *
 * This can be a multi-step pipeline for larger objects.  That is a very common need
 * when working with certain API types, like SOAP endpoints.
 *
 * @param {Array} records raw timecards from the Extractor
 * @return {Array}
 */
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

/**
 * expandMultiDayRecord
 * @description
 * Given a timecard that represents multiple days, break it up into smaller records
 * until it represents individual days only.
 *
 * This is done with two scoped functions, one each for the first and second days.
 * There is room for expansion to cover intermediary days, but 3-day shifts have
 * never happened in practice (thankfully).  If they did, they would be punctuated
 * by breaks for meals, which would invalidate the need for a buildMiddleDatesRecords()
 *
 * @param {Object} record a timecard representing more than one day
 * @return {Array}
 */
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

/**
 * expandToDaily
 * @description
 * Given a timecard that represents multiple days, break it up into smaller records
 * until it represents individual days only.
 *
 * @param {Array} records timecards
 * @return {Array}
 */
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

/**
 * expandMultiHourRecord
 * @description
 * Given a timecard that represents multiple hours, break it up into smaller records
 * until it represents individual hours only.
 *
 * This is done with three scoped functions, two for the first and last hours which
 * represent only partial availability records, and one for the middle hours which
 * which represent full availabilty records.
 *
 * @param {Object} record timecards that represent a single day, but multiple hours
 * @return {Array}
 */
const expandMultiHourRecord = record => {
  /**
   * buildStartHourRecord
   * @description
   * Given a timecard that represents multiple hours, create the record for the first hour.
   * This record will cover the clock-in to the end of the hour in which the
   * clock-in took place.  These records will cover minute X to 59.
   *
   * @param {Object} record timecard that represent a single day, but multiple hours
   * @return {Object}
   */
  const buildStartHourRecord = r => {
    const { email, startHour, startTime } = r;

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

  /**
   * buildStartHourRecord
   * @description
   * Given a timecard that represents multiple hours, create the records for the
   * intermediary hours.  These records will will cover an entire hour, minute 0 through 59.
   *
   * @param {Object} record timecard that represent a single day, but multiple hours
   * @return {Array}
   */
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

  /**
   * buildEndHourRecord
   * @description
   * Given a timecard that represents multiple hours, create the record for the last hour.
   * This record will cover the clock-out to the beginning of the hour in which the
   * clock-out took place. These records will cover minute 0 to X.
   *
   * @param {Object} record timecard that represent a single day, but multiple hours
   * @return {Object}
   */
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

/**
 * expandToHourly
 * @description
 * Given timecard records that represent a single day of work (if Techs work late shifts or
 * are abroad), expand each timecard into smaller records until they represent only
 * a single hour each.
 *
 * @param {Array} records timecards that represent a single day
 * @return {Array}
 */
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

/**
 * groupRecordsByEmailDateAndHour
 * @description
 * Given timecard records that represent a single hour of a single day, group them by
 * Tech, by Date worked, and by Hour worked.
 *
 * @param {Array} records timecards that represent a single hour
 * @return {Object}
 */
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

/**
 * createWorkAvailabilityRecord
 * @description
 * Given records grouped by Email, Date, and Hour, create Work Availability records.
 *
 * These records should have a sum of all minutes worked by this Tech
 * on a given Date in a given Hour of that day.  It should also represent
 * which minutes of the hour contributed to that sum.
 *
 * This minute-by-minute specificity allows us to match our analysis to other metrics,
 * such as Chat Concurrency (how many chats was a Tech working simultaneously), and validate
 * that Techs are remembering to clock-in and clock-out on breaks _and_ stopped working
 * during those clocked-out minutes.
 *
 * @param {Object} recordsObj records grouped by Email, Date and Hour
 * @return {Array}
 */
const createWorkAvailabilityRecord = recordsObj => {
  const workMinuteRecords = []; // the output records that we will log
  const minutesArrayTemplate = new Array(60).fill(0); // an array representing each minute of the hour

  Object.keys(recordsObj).forEach(email => {
    Object.keys(recordsObj[email]).forEach(date => {
      Object.keys(recordsObj[email][date]).forEach(hour => {
        const workMinutesArray = [...minutesArrayTemplate];

        recordsObj[email][date][hour].forEach(record => {
          const { startMin, endMin } = record;

          // for each minute a Tech worked in a given Hour,
          // iterate the corresponding slot in the workMinutesArray
          for (let i = startMin; i <= endMin; i += 1) {
            workMinutesArray[i] += 1;
          }
        });

        /*
         * NOTE:
         * It is not uncommon for clock-ins and clock-outs to not fully register with the HR
         * system. This can create instances where we have more than one record representing
         * the same minutes of an hour after a Manager alters it.
         *
         * This behavior creates a situation where a minute can be counted multiple times.
         * We round these instances down to 1, because it breaks the laws of physics for a Tech
         * to work the same minute twice concurrently.
         */

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

/**
 * applyBusinessLogic
 * @description
 * From the cleaned records, separate timecard records into
 * (1) records representing each day
 * (2) records representing each hour of each day
 *
 * Then, since meal hours can have more than one timecard be relevant,
 * group records by the Tech, Date and Hour of occurence.
 *
 * Work Availability records will be created from these group records.
 *
 * @param {Array} records cleaned results from the Extractor
 * @return {Array}
 */
const applyBusinessLogic = records => {
  const businessLogicPipeline = composePipeline(
    expandToDaily,
    expandToHourly,
    groupRecordsByEmailDateAndHour,
    createWorkAvailabilityRecord
  );

  return businessLogicPipeline(records);
};

/**
 * prepareForBigQuery
 * @description
 * Apply required BigQuery schema.
 *
 * Schema is:
 * wa_email: String,
 * wa_date: Date,
 * wa_hour: Time,
 * wa_work_minutes_sum: Integer
 * wa_work_minutes_array: Repeated Integers
 *
 * @param {Array} records Work Availability records
 * @return {Array}
 */
const prepareForBigQuery = records => {
  return records.map(record => {
    const { email, date, hour, workMinutesSum, workMinutesArray } = record;

    return {
      // Primary Keys
      wa_email: email,
      wa_date: date,
      wa_hour: hour,

      // Values
      wa_work_minutes_sum: workMinutesSum,
      wa_work_minutes_array: workMinutesArray
    };
  });
};

/**
 * transformer
 * @description
 * Recieve records from the Extractor, clean it, form the Availability record, and
 * put it into BigQuery's expected schema.
 *
 * @param {Array} records raw array of results from the Extractor
 * @return {Array}
 */
const transformer = records => {
  const transformPipeline = composePipeline(cleanupRecords, applyBusinessLogic, prepareForBigQuery);

  return transformPipeline(records);
};

export default transformer;

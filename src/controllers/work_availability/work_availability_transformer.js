import _ from 'underscore';
import composePipeline from '../../helpers/compose_pipeline';

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

      // Values
      wa_work_minutes_sum: workMinutesSum,
      wa_work_minutes_array: workMinutesArray
    };
  });
};

const transformer = records => {
  const transformPipeline = composePipeline(cleanupRecords, applyBusinessLogic, prepareForBigQuery);

  return transformPipeline(records);
};

export default transformer;

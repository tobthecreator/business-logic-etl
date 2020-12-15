import { getDatetimeString, getDateString } from './iso_string_parser';

const calculateStartAndEndTimes = (
  request,
  defaultDayDifference = 14,
  calculateFromMidnights = false
) => {
  let startTime;
  let endTime;

  if (request.method === 'POST') {
    startTime = request.body.startTime;
    endTime = request.body.endTime;
  }

  if (request.method === 'GET') {
    const endTimeDateObj = new Date();
    const startTimeDateObj = new Date();

    startTimeDateObj.setHours(startTimeDateObj.getHours() - 24 * defaultDayDifference);

    if (calculateFromMidnights) {
      startTime = getDateString(startTimeDateObj);
      endTime = getDateString(endTimeDateObj);
    } else {
      startTime = getDatetimeString(startTimeDateObj);
      endTime = getDatetimeString(endTimeDateObj);
    }
  }

  return { startTime, endTime };
};

export default calculateStartAndEndTimes;

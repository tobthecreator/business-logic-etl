export const getDateString = dateObj => {
  return dateObj.toISOString().split('T')[0];
};

export const getDatetimeString = dateObj => {
  return dateObj.toISOString().split('.')[0];
};

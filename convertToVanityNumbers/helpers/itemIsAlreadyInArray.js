const isItemAlreadyInArray = (item, array) => {
  let exists = false;
  if (array.includes(item)) {
    exists = true;
    return exists;
  }

  return exists;
};

module.exports = isItemAlreadyInArray;

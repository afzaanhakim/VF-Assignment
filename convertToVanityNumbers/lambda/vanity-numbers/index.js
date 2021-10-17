("use strict");
const getRandomInt = require("../../helpers/getRandomInt");
const axios = require("axios");
const AWS = require("aws-sdk");

const {
  MAX_ALLOWED_RETRIES,
  DESIRED_NUMBER_OF_VANITY_NUMBERS,
  AWS_REGION,
  DICTIONARY_API_KEY,
} = process.env;

let docClient = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION,
  apiVersion: "2012-08-10",
});

const arrayOfRandomness = [];

exports.handler = async function (event, context, callback) {
  console.log(JSON.stringify(`Event: ${event}`));
  let vanityNumbers = [];

  const { phoneNumber } = event;
  try {
    vanityNumbers = await convertNumberToVanityNumber(
      phoneNumber,
      6,
      0,
      [],
      []
    );

    console.log(`Finished collecting 6 digit combinations: ${vanityNumbers}`);
    if (vanityNumbers < DESIRED_NUMBER_OF_VANITY_NUMBERS) {
      let fiveDigitNumbers = await convertNumberToVanityNumber(
        phoneNumber,
        5,
        0,
        [],
        []
      );
      vanityNumbers = [...vanityNumbers, ...fiveDigitNumbers];

      console.log(`Finished collecting 5 digit combinations: ${vanityNumbers}`);
    } else {
      await insertVanityNumbers(vanityNumbers, phoneNumber);
      return;
    }

    if (vanityNumbers < DESIRED_NUMBER_OF_VANITY_NUMBERS) {
      let fourDigitNumbers = await convertNumberToVanityNumber(
        phoneNumber,
        4,
        0,
        [],
        []
      );

      vanityNumbers = [...vanityNumbers, ...fourDigitNumbers];

      console.log(`Finished collecting 4 digit combinations: ${vanityNumbers}`);
    } else {
      await insertVanityNumbers(vanityNumbers, phoneNumber);
      return;
    }

    if (vanityNumbers < DESIRED_NUMBER_OF_VANITY_NUMBERS) {
      let threeDigitNumbers = await convertNumberToVanityNumber(
        phoneNumber,
        3,
        0,
        [],
        []
      );

      vanityNumbers = [...vanityNumbers, ...threeDigitNumbers];

      console.log(
        `Finishshed collecting 3 digit combinations: ${vanityNumbers}`
      );
    } else {
      await insertVanityNumbers(vanityNumbers, phoneNumber);
      return;
    }

    vanityNumbers = await handleMissingVanityNumbers(
      vanityNumbers,
      phoneNumber
    );
    await insertVanityNumbers(vanityNumbers, phoneNumber);
    return;
  } catch (err) {
    console.log("Error", err);
    return { success: false };
  }
};

async function insertVanityNumbers(vanityNumbers, phoneNumber) {
  console.log(`\n Final vanity number generation results: ${vanityNumbers}`);

  try {
    if (vanityNumbers.length !== DESIRED_NUMBER_OF_VANITY_NUMBERS) {
      console.log(
        `We do not yet have enough vanity numbers to add to the db. Generating more... `
      );
      vanityNumbers = await handleMissingVanityNumbers(
        vanityNumbers,
        phoneNumber
      );
    }
    console.log(vanityNumbers);
    const params = {
      TableName: "Callers",
      Item: {
        id: phoneNumber,
        vanityNumber1: vanityNumbers[0],
        vanityNumber2: vanityNumbers[1],
        vanityNumber3: vanityNumbers[2],
        vanityNumber4: vanityNumbers[3],
        vanityNumber5: vanityNumbers[4],
      },
    };

    console.log(params);

    const response = await docClient.put(params).promise();
    console.log("acsn response; ", response);
  } catch (error) {
    console.log(`DocClient request fail: ${error}`);
  }
}

async function convertNumberToVanityNumber(
  number,
  numberOfDigitsToConvert,
  tries,
  vanityNumbers = []
) {
  if (tries >= MAX_ALLOWED_RETRIES) {
    return vanityNumbers;
  }

  const numberList = {
    0: [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ],
    1: [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ],
    2: ["A", "B", "C"],
    3: ["D", "E", "F"],
    4: ["G", "H", "I"],
    5: ["J", "K", "L"],
    6: ["M", "N", "O"],
    7: ["P", "Q", "R", "S"],
    8: ["T", "U", "V"],
    9: ["W", "X", "Y", "Z"],
  };

  let cCode = number.slice(0, 4); //getting country code

  let lastDigits = number.slice(4, number.length); //getting numbers to be converted to letters

  let digitsToPersist = lastDigits.substr(0, numberOfDigitsToConvert);

  let numbersToConvert = "";

  for (let i = 0; i <= numberOfDigitsToConvert; i++) {
    numbersToConvert += lastDigits[i];
  }

  let word = "";
  for (n of numbersToConvert) {
    const newChar = numberList[n][getRandomInt(0, numberList[n].length - 1)];

    word += newChar;
  }

  try {
    console.log("Initializing validity check for word", word);
    const isValidWord = await checkWord(word);

    if (isValidWord) {
      if (numberOfDigitsToConvert !== 7) {
        vanityNumbers.push(cCode + digitsToPersist + word);
      } else {
        vanityNumbers.push(cCode + word);
      }

      if (vanityNumbers.length > 4) {
        console.log("We have all the vanity numbers we need, ending search");
        return vanityNumbers;
      } else {
        console.log(
          `We still only have ${vanityNumbers.length} vanity numbers. Continuing to search.`
        );

        return convertNumberToVanityNumber(
          number,
          numberOfDigitsToConvert,
          (tries += 1),
          vanityNumbers
        );
      }
    } else {
      if (numberOfDigitsToConvert === 3) {
        arrayOfRandomness.push(cCode + digitsToPersist + word);
      }
      return convertNumberToVanityNumber(
        number,
        numberOfDigitsToConvert,
        (tries += 1),
        vanityNumbers
      );
    }
  } catch (error) {
    console.log(error);
    return [];
  }

  async function checkWord(word) {
    try {
      console.log(`Looking up ${word} in the API`);
      const options = {
        method: "GET",
        url: `https://wordsapiv1.p.rapidapi.com/words/${word}/typeOf`,
        headers: {
          "x-rapidapi-host": "wordsapiv1.p.rapidapi.com",
          "x-rapidapi-key": DICTIONARY_API_KEY,
        },
      };

      const result = await axios.request(options);

      console.log(`Received response from endpoint ${options.url}: ${result}`);
      console.log(`The word ${word} is a valid word\n`);

      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`The word ${word} is not a valid English word.\n`);
        return false;
      }

      return false;
    }
  }
}

async function handleMissingVanityNumbers(vanityNumbers, phoneNumber) {
  if (arrayOfRandomness?.length !== DESIRED_NUMBER_OF_VANITY_NUMBERS) {
    await convertNumberToVanityNumber(phoneNumber, 3, 0, vanityNumbers);
  }

  if (vanityNumbers.length === 0) {
    vanityNumbers = arrayOfRandomness;
    return vanityNumbers;
  }

  if (vanityNumbers.length === 1) {
    console.log("Adding 4 randoms to vanityNumbers: ", vanityNumbers);

    vanityNumbers.push(arrayOfRandomness[0]);
    vanityNumbers.push(arrayOfRandomness[1]);
    vanityNumbers.push(arrayOfRandomness[2]);
    vanityNumbers.push(arrayOfRandomness[3]);
    console.log("Added 4 randoms to vanityNumbers: ", vanityNumbers);

    return vanityNumbers;
  }

  if (vanityNumbers.length === 2) {
    console.log("Adding 3 randoms to vanityNumbers: ", vanityNumbers);

    vanityNumbers.push(arrayOfRandomness[0]);
    vanityNumbers.push(arrayOfRandomness[1]);
    vanityNumbers.push(arrayOfRandomness[2]);
    console.log("Added 3 randoms to vanityNumbers: ", vanityNumbers);
    console.log("this is line 340", vanityNumbers);
    return vanityNumbers;
  }

  if (vanityNumbers.length === 3) {
    console.log("Adding 2 randoms to vanityNumbers: ", vanityNumbers);

    vanityNumbers.push(arrayOfRandomness[0]);
    vanityNumbers.push(arrayOfRandomness[1]);
    console.log("Added 2 randoms to vanityNumbers: ", vanityNumbers);

    return vanityNumbers;
  }

  if (vanityNumbers.length === 4) {
    console.log("Adding 1 randoms to vanityNumbers: ", vanityNumbers);

    vanityNumbers.push(arrayOfRandomness[0]);
    console.log("Added 1 randoms to vanityNumbers: ", vanityNumbers);

    return vanityNumbers;
  }
}

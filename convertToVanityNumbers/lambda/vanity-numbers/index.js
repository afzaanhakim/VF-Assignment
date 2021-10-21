("use strict");
const getRandomInt = require("../../helpers/getRandomInt");
const isItemAlreadyInArray = require("../../helpers/itemIsAlreadyInArray");
const axios = require("axios");
const AWS = require("aws-sdk");

const {
  MAX_ALLOWED_RETRIES,
  DESIRED_NUMBER_OF_VANITY_NUMBERS,
  AWS_REGION,
  DICTIONARY_API_KEY,
} = process.env; // These items are required to be present in AWS Lambda environment variables!

const docClient = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION,
  apiVersion: "2012-08-10",
});

exports.handler = async function (event, context, callback) {
  console.log("Received event; ", event, JSON.stringify(event));
  let vanityNumbers = [];

  let { phoneNumber } = event; // retreiving caller phone number from event

  phoneNumber = phoneNumber.replace("+", ""); //  removing special characterss from phone numbers

  try {
    console.log(`Starting to collect 6 digit combinations.`);

    //  attempt to generate enough 6 letter vanity numbers
    vanityNumbers = await convertNumberToVanityNumber(phoneNumber, 6, 0, []);

    console.log(
      `Finished collecting 6 digit combinations: ${vanityNumbers}, created ${vanityNumbers.length} valid numbers.`
    );

    if (vanityNumbers?.length < parseInt(DESIRED_NUMBER_OF_VANITY_NUMBERS)) {
      console.log(`Starting to collect 5 digit combinations.`);

      //  attempt to generate enough 5 letter vanity numbers
      fiveDigitNumbers = await convertNumberToVanityNumber(
        phoneNumber,
        5,
        0,
        vanityNumbers
      );

      console.log(
        `Finished collecting 5 digit combinations: ${vanityNumbers}, created ${fiveDigitNumbers}.`
      );
    } else {
      //  we have enough numbers for the caller, just insert them
      await insertVanityNumbers(vanityNumbers, phoneNumber);
      return;
    }

    if (vanityNumbers?.length < parseInt(DESIRED_NUMBER_OF_VANITY_NUMBERS)) {
      console.log(`Starting to collect 4 digit combinations.`);

      //  attempt to generate enough 4 letter vanity numbers
      let fourDigitNumbers = await convertNumberToVanityNumber(
        phoneNumber,
        4,
        0,
        vanityNumbers
      );

      console.log(
        `Finished collecting 4 digit combinations: ${vanityNumbers}, created ${fourDigitNumbers}.`
      );
    } else {
      // we have enough numbers for the caller, just insert them
      await insertVanityNumbers(vanityNumbers, phoneNumber);
      return;
    }

    if (vanityNumbers?.length < parseInt(DESIRED_NUMBER_OF_VANITY_NUMBERS)) {
      console.log(`Starting to collect 3 digit combinations.`);

      //  attempt to generate enough 3 letter vanity numbers
      let threeDigitNumbers = await convertNumberToVanityNumber(
        phoneNumber,
        3,
        0,
        vanityNumbers
      );

      console.log(
        `Finished collecting 3 digit combinations: ${vanityNumbers}, created ${threeDigitNumbers}.`
      );
    } else {
      // we have enough numbers for the caller, just insert them

      await insertVanityNumbers(vanityNumbers, phoneNumber);
      return;
    }

    //  we have tried everything we can but still dont have enough numbers. Add random ones to our array for padding
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

async function insertVanityNumbers(vanityNumbers = [], phoneNumber) {
  console.log(`\n Final vanity number generation results: ${vanityNumbers}`);

  try {
    if (
      vanityNumbers &&
      vanityNumbers.length !== parseInt(DESIRED_NUMBER_OF_VANITY_NUMBERS) // check if for some reason we dont have enough numbers by the time we get here
    ) {
      console.log(
        `We do not yet have enough vanity numbers to add to the db. Generating more... `
      );
      await handleMissingVanityNumbers(vanityNumbers, phoneNumber); // try to fill in missing numbers
    }

    if (vanityNumbers?.length !== parseInt(DESIRED_NUMBER_OF_VANITY_NUMBERS)) {
      await handleMissingVanityNumbers(vanityNumbers, phoneNumber); // try to fill in missing numbers one last time in case we end up missing any.
    }

    //  building params for ddb request
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

    console.log(`Making DocClient put reques ${params}`);
    const response = await docClient.put(params).promise(); // make request and capture response to log
    console.log(`Made DocClient put reques ${response}`);
    return;
  } catch (error) {
    console.log(`DocClient request fail: ${error}`);
  }
}

async function convertNumberToVanityNumber(
  number,
  numberOfDigitsToConvert,
  tries,
  vanityNumbers = [],
  isLastDitchEffort
) {
  if (tries >= parseInt(MAX_ALLOWED_RETRIES)) {
    return vanityNumbers; // exit recursion loop after max tries
  }

  if (vanityNumbers.length >= parseInt(DESIRED_NUMBER_OF_VANITY_NUMBERS)) {
    return vanityNumbers; // we have enough numbers, exit
  }

  const numberList = {
    // generating alphabets for numbers(0 and 1 can be any of the 26 alphabets) while other numbers relate to the keys (alphabets) on a phone dialpad
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

  let numbersToConvert = ""; //initialize empty string to be converted to the letters

  for (let i = 0; i <= numberOfDigitsToConvert; i++) {
    numbersToConvert += lastDigits[i];
  }

  let word = ""; //  word that we build by adding random chars from numberList"
  for (n of numbersToConvert) {
    const newChar = numberList[n][getRandomInt(0, numberList[n].length - 1)];

    word += newChar;
  }

  try {
    let itemExists = isItemAlreadyInArray(
      `${cCode}${digitsToPersist}${word}`,
      vanityNumbers
    );

    if (itemExists === false) {
      console.log(`The item ${word} does not exist in the array, inserting.`);

      console.log("validiting word", word);
      // Run API call to check validity of word
      const isValidWord = await checkWord(word);

      if (isValidWord) {
        if (numberOfDigitsToConvert !== 7) {
          //if the word is not a 7 letter word then persisting digits
          vanityNumbers.push(cCode + digitsToPersist + word);
        } else {
          vanityNumbers.push(cCode + word); //if the word is a 7 letter word then joining it with the country Code
        }

        //if length of vanity numbers array is 5 then condition of getting vanity numbers for a phone number is fulfilled
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
          ); //if condition of getting 5 vanity numbers is not fulfilled then calling function recursively to regenerate new number and adding an extra try
        }
      } else {
        // when we dont have a valid word, if we are at our last attempt, fill the randomness array to pad missing numbers

        if (numberOfDigitsToConvert === 3 && isLastDitchEffort) {
          console.log(
            "this isn our last ditch effort. trying to make random vanity numbers to pad our array.",
            vanityNumbers,
            `${cCode}${digitsToPersist}${word}`
          );

          if (vanityNumbers?.length < DESIRED_NUMBER_OF_VANITY_NUMBERS) {
            if (
              !isItemAlreadyInArray(
                cCode + digitsToPersist + word,
                vanityNumbers
              )
            ) {
              console.log(
                `Word ${word} does not exist in our array ${vanityNumbers}. Inserting.`
              );
              vanityNumbers.push(cCode + digitsToPersist + word);
              return convertNumberToVanityNumber(
                number,
                numberOfDigitsToConvert,
                (tries += 1),
                vanityNumbers,
                true
              );
            } else {
              console.log(
                `Word ${word} already exists in our array ${vanityNumbers}. Skipping.`
              );
              return convertNumberToVanityNumber(
                number,
                numberOfDigitsToConvert,
                (tries += 1),
                vanityNumbers,
                true
              );
            }
          } else {
            console.log(
              `Our last ditch effort was succesfull; here are your vanity numbers  ${vanityNumbers} We are victorious.`
            );
            return vanityNumbers;
          }
        }

        return convertNumberToVanityNumber(
          number,
          numberOfDigitsToConvert,
          (tries += 1),
          vanityNumbers
        );
      }
    } else {
      console.log(`The item already exists in the array, skipping insertion.`);
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
    //async function to make API call to check if the word is a valid word
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
        // when an invalid word is passed into the API call it returns a 404 error with false success value?
        console.log(`The word ${word} is not a valid English word.\n`);
        return false;
      }

      return false;
    }
  }
}

async function handleMissingVanityNumbers(vanityNumbers, phoneNumber) {
  //function to handle adding additional random vanity numbers if we do not have succifient numbers
  try {
    console.log(
      `handling missing vanity unmbers for array ${vanityNumbers} ${vanityNumbers?.length}`
    );
    const arrayOfRandomness = await convertNumberToVanityNumber(
      phoneNumber,
      3,
      0,
      vanityNumbers,
      true
    ); //calling vanityNumberconverting function again if condition is not fullfilled of having sufficient vanity numbers /random numbers

    console.log(
      `here is the array of randomness after the last ditch effort `,
      arrayOfRandomness,
      vanityNumbers
    );

    if (vanityNumbers?.length === 0) {
      vanityNumbers = arrayOfRandomness;
      return vanityNumbers;
    }

    if (vanityNumbers?.length === 1) {
      //if we get one vanitynumber with an actual word,  we have to add four randoms
      console.log("Adding 4 randoms to vanityNumbers: ", vanityNumbers);

      if (!isItemAlreadyInArray(arrayOfRandomness[0], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[0]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[0]} already exists in array ${vanityNumbers}`
        );
      }
      if (!isItemAlreadyInArray(arrayOfRandomness[1], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[1]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[1]} already exists in array ${vanityNumbers}`
        );
      }
      if (!isItemAlreadyInArray(arrayOfRandomness[2], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[2]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[2]} already exists in array ${vanityNumbers}`
        );
      }
      if (!isItemAlreadyInArray(arrayOfRandomness[3], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[3]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[3]} already exists in array ${vanityNumbers}`
        );
      }

      console.log("Added 4 randoms to vanityNumbers: ", vanityNumbers);

      return vanityNumbers;
    }

    if (vanityNumbers?.length === 2) {
      //if we get two vanitynumber with an actual word,  we have to add three randoms
      console.log("Adding 3 randoms to vanityNumbers: ", vanityNumbers);
      if (!isItemAlreadyInArray(arrayOfRandomness[0], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[0]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[0]} already exists in array ${vanityNumbers}`
        );
      }
      if (!isItemAlreadyInArray(arrayOfRandomness[1], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[1]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[1]} already exists in array ${vanityNumbers}`
        );
      }
      if (!isItemAlreadyInArray(arrayOfRandomness[2], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[2]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[2]} already exists in array ${vanityNumbers}`
        );
      }

      console.log("Added 3 randoms to vanityNumbers: ", vanityNumbers);

      return vanityNumbers;
    }

    if (vanityNumbers?.length === 3) {
      //if we get three vanitynumber with an actual word,  we have to add two randoms
      console.log("Adding 2 randoms to vanityNumbers: ", vanityNumbers);

      if (!isItemAlreadyInArray(arrayOfRandomness[0], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[0]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[0]} already exists in array ${vanityNumbers}`
        );
      }
      if (!isItemAlreadyInArray(arrayOfRandomness[1], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[1]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[1]} already exists in array ${vanityNumbers}`
        );
      }
      console.log("Added 2 randoms to vanityNumbers: ", vanityNumbers);

      return vanityNumbers;
    }

    if (vanityNumbers?.length === 4) {
      //if we get four vanitynumber with an actual word,  we have to add one randoms number
      console.log("Adding 1 randoms to vanityNumbers: ", vanityNumbers);

      if (!isItemAlreadyInArray(arrayOfRandomness[0], vanityNumbers)) {
        vanityNumbers.push(arrayOfRandomness[0]); //push items from array of random numbers into array of vanity numbers
      } else {
        console.log(
          `ArrayOfRandomness push failed because ${arrayOfRandomness[0]} already exists in array ${vanityNumbers}`
        );
      }

      console.log("Added 1 randoms to vanityNumbers: ", vanityNumbers);

      return vanityNumbers;
    }
  } catch (error) {
    console.log(error);
  }
}

// handler({ phoneNumber: "+14168252786" })
//   .then(() => console.log("done"))
//   .catch((error) => console.log(error));

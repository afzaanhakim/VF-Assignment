"use strict";
const AWS = require("aws-sdk");
const getRandomInt = require("../../helpers/getRandomInt");
const { AWS_REGION } = process.env;
const docClient = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION || "us-east-1",
  apiVersion: "2012-08-10",
});

exports.handler = async function (event, context, callback) {
  console.log(JSON.stringify(`Event: ${event}`));

  let { phoneNumber } = event.Details.Parameters;

  phoneNumber = phoneNumber.replace("+", "");
  if (phoneNumber) {
    const params = {
      TableName: "Callers",
      Key: {
        id: phoneNumber,
      },
    };

    try {
      const response = await docClient.get(params).promise();
      console.log(response);

      if (response && response.Item) {
        console.log(
          `The caller is in our system, returning 3 random vanity numbers.`
        );

        const vanityNumbersToSpeak = getRandomVanityNumbers(
          3,
          response.Item,
          []
        );

        console.log("Returning vanityNumbersToSpeak ,", vanityNumbersToSpeak);

        return {
          vanityNumber1: vanityNumbersToSpeak[0],
          vanityNumber2: vanityNumbersToSpeak[1],
          vanityNumber3: vanityNumbersToSpeak[2],
          success: true,
          userHasCalledBefore: true,
        };
      } else {
        return { userHasCalledBefore: false };
      }
    } catch (error) {
      console.log(`DocClient request fail: ${error}`);
      return { error: true, success: false, errorMessage: error.message };
    }
  } else {
    return { error: true, success: false };
  }
};

function getRandomVanityNumbers(
  numberOfVanityNumbersToGet,
  vanityNumbers,
  arrayOfRandomVanityNumbers
) {
  if (arrayOfRandomVanityNumbers.length < numberOfVanityNumbersToGet) {
    for (let i = 0; i < numberOfVanityNumbersToGet; i++) {
      let randomInt = getRandomInt(1, 5);

      if (
        !arrayOfRandomVanityNumbers.includes(
          vanityNumbers[`vanityNumber${randomInt}`]
        )
      ) {
        arrayOfRandomVanityNumbers.push(
          vanityNumbers[`vanityNumber${randomInt}`]
        );

        console.log(
          "Added ",
          vanityNumbers[`vanityNumber${randomInt}`],
          " to arrayOfRandomVanityNumbers; ",
          arrayOfRandomVanityNumbers
        );

        return getRandomVanityNumbers(
          numberOfVanityNumbersToGet,
          vanityNumbers,
          arrayOfRandomVanityNumbers
        );
      } else {
        console.log(
          vanityNumbers[`vanityNumber${randomInt}`],
          " Is already in array of random vanity numbers; ",
          arrayOfRandomVanityNumbers
        );
        return getRandomVanityNumbers(
          numberOfVanityNumbersToGet,
          vanityNumbers,
          arrayOfRandomVanityNumbers
        );
      }
    }
  } else {
    console.log(
      "We have enough items in the array to return; ",
      arrayOfRandomVanityNumbers
    );
    return arrayOfRandomVanityNumbers;
  }
}

// *******uncomment below for local testing*****

// const item = {
//   Item: {
//     vanityNumber5: "1416825VCKB",
//     id: "14168252786",
//     vanityNumber3: "1416825VBKC",
//     vanityNumber4: "1416825UBLB",
//     vanityNumber1: "1416825VALA",
//     vanityNumber2: "1416825VBKC",
//   },
// };

// const test = getRandomVanityNumbers(3, item.Item, []);

// console.log(test);

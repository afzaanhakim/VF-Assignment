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

  phoneNumber = phoneNumber.replace("+", ""); //removing special character from phone number
  if (phoneNumber) {
    const params = {
      //setting params for DDB
      TableName: "Callers",
      Key: {
        id: phoneNumber,
      },
    };

    try {
      const response = await docClient.get(params).promise();

      if (response && response.Item) {
        //checking if response from DDB with Item for existing caller exists in DDB
        console.log(
          `The caller is in our system, returning 3 random vanity numbers.`
        );

        const vanityNumbersToSpeak = getRandomVanityNumbers(
          //getting 3 random vanity Numbers to speak from list of 5 in DDB
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
      let randomInt = getRandomInt(1, 5); //calling helper function to retrieve a random index between 1 - 5 for the vanity number

      if (
        !arrayOfRandomVanityNumbers.includes(
          //checking if the vanityNumber is not already pushed to the array of random Vanity numbers to speak
          vanityNumbers[`vanityNumber${randomInt}`]
        )
      ) {
        arrayOfRandomVanityNumbers.push(
          vanityNumbers[`vanityNumber${randomInt}`] //If numbr not in array then we push that vanitynumber
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
        // vanity number is already in the array
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
    //  accrued enough numbers to speak back to the caller
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

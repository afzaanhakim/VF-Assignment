# VF-Assignment

The objective of this assignment is to generate vanity numbers for a caller. The caller will first call the Amazon Connect number, the caller-lookup lambda will check the Dynamo DB to see if the phoner number exists, if it is a new caller whose number does not already exist, the IVR will ask the caller to call back to listen to their vanity numbers, the callers phone number will be asynchronously passed to the lambda that will convert the phone-number and generate 5 random vanity numbers.

When a caller calls back again, the caller-lookup function will retrieve the parameters from the event that consist of the phone number, and fetch 3 random vanity numbers from the 5 that are in the DDB.

The best vanity numbers are identified by making an api call to the RapidAPI Words API to check if a word that is formed based on nuumbers is a valid english word or not. If it is a valid word it is added to the number and  it is passed into an array until that array has 5 vanity numbers. If we do not have enough valid vanity numbers, the random words generated are added to the phonenumber and passed into the array of vanity numbers to fulfill the condition. 



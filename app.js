
//imports
var cors = require('cors');
var express = require('express');
var parser = require('body-parser');
var http = require('http');
var url = require('url');

//setup
var app = express();
app.use(parser.urlencoded({extended: false}));
app.use(parser.json());
app.use(cors());

//global variables
var secretSantaIsImpossible = false;          //switch indicating whether or not it's possible to generate secret santas for everyone in given list
var jsonResponse = {};                  //object we will populate and send back as response
var body = {};                      //This object and the few variables below it are necessary helper variables for some of the algorithms of this API.
var jsonType = 0;                     //This API can handle two different formats of JSON payloads; this variable will denote which type is being used.
var unselectedParticipants = [],
 unselectedParticipantsHelper = [];
var participants = [];

//Check two participants to see if they are in any of the same incompatibility groups.
function pairIsCompatible(participant1, participant2) {
 var compatible = true;
 for (var key in body) {
  if (key.substring(0, key.indexOf('[')) === participant1) {
   var incompatibilityGroup = key.substring( key.indexOf('[') + 1, key.indexOf(']') );
   for(var key2 in body) {
    var incompatibilityGroup2 = key2.substring( key2.indexOf('[') + 1, key2.indexOf(']') ),
     currentParticipant = key2.substring(0, key2.indexOf('['));
    if (incompatibilityGroup === incompatibilityGroup2
     && participant1 !== currentParticipant
     && incompatibilityGroup2 !== 'initialized'
     && participant2 === key2.substring( 0, key2.indexOf('[')) ) {
     compatible = false;
    }
   }
  }
 }
 if ((participant1 === '') || (participant2 === '')) {
  compatible = false;
 }
 return compatible;
}

//Check that a participant does not already belong to another secret santa.
function participantIsAvailable(participant) {
 var isAvailable = true;
 for(var key in jsonResponse) {
  if (jsonResponse[key] === participant) {
   isAvailable = false;
  }
 }
 return isAvailable;
}

//Check to see if there are any secret santas who are able to give up their current targets.
//If a secret santa could have another viable target, he/she is capable of trading his/her current target with someone else that lacks a viable target.
function swapWithOtherParticipant(participant) {
 var swapIsPossible = false;
 for(var key in jsonResponse) {
  if (pairIsCompatible(participant, jsonResponse[key])) {
   for(var k=0; k<participants.length; k++) {
    if (participantIsAvailable(participants[k])
     && pairIsCompatible(key, participants[k])
     && key !== participants[k]) {
     swapIsPossible = true;
     jsonResponse[participant] = jsonResponse[key];
     jsonResponse[key] = participants[k];
     for(var l=0; l<unselectedParticipantsHelper.length; l++) {
      if (unselectedParticipantsHelper[l] === participants[k]) {
       unselectedParticipantsHelper.splice(l, 1);
      }
     }
    }
   }
  }
 }
 return swapIsPossible;
}

//Generate target for a participant to be a secret santa for, if possible.
function selectPartners(participant) {
 var randomNumber = Math.floor(Math.random() * (unselectedParticipantsHelper.length));
 if (pairIsCompatible(participant, unselectedParticipantsHelper[randomNumber])
  && participantIsAvailable(unselectedParticipantsHelper[randomNumber])) {
  jsonResponse[participant] = unselectedParticipantsHelper[randomNumber];
  unselectedParticipantsHelper.splice(randomNumber, 1);
 }
  else {
   unselectedParticipantsHelper.splice(randomNumber, 1);
   if (unselectedParticipantsHelper.length > 0) {
    selectPartners(participant);
   }
    else {
     if (!swapWithOtherParticipant(participant)) {
      secretSantaIsImpossible = true;
     }
     else {
      selectPartners(participant);
     }
    }
  }
}

//Convert JSON to desired format if it is received in another supported format.
function convertToPreferredJsonFormat(jsonRequest) {
 var convertedJson = {};
 for(var key in jsonRequest) {
  for(var key2 in jsonRequest[key]) {
   var newKey = key + '[' + key2 + ']';
   convertedJson[newKey] = "" + jsonRequest[key][key2];
  }
 }
 return convertedJson;
}

app.post('/', function(req, res) {

 //console.log('Request body received: ', JSON.stringify(req.body));

 body = req.body;

 //Determine whether or not JSON has been provided in an alternate supported type.
 for (var key in req.body) {
  if (key.includes("[")) {
   jsonType = 1;
   break;
  }
 }

 //If JSON is provided in another supported type, convert to preferred type.
 if (jsonType !== 1) {
  req.body = convertToPreferredJsonFormat(req.body);
  //console.log('Request body converted: ', JSON.stringify(req.body));
 }

 //populate global variables
 for (var key in req.body) {
   var participant = key.substring(0, key.indexOf('[')),
    alreadyExists = false;
   for(i=0; i<participants.length; i++) {
     if (participants[i] === participant) {
     alreadyExists = true;
    }
   }
   if (!alreadyExists) {
    participants.push(participant);
    unselectedParticipants.push(participant);
    jsonResponse[participant] = '';
   }
 }

 //Generate all secret santa targets for all participants.
 for(var j=0; j<participants.length; j++) {
  unselectedParticipantsHelper = unselectedParticipants.slice();
  for(var i=0; i<unselectedParticipantsHelper.length; i++) {
   if (unselectedParticipantsHelper[i] === participants[j]) {
    unselectedParticipantsHelper.splice(i, 1);
   }
  }
  selectPartners(participants[j]);
 }

 //If we've determined that a full set of secret santas cannot be generated from the input, denote this by responding with an empty object.
 if (secretSantaIsImpossible) {
  jsonResponse = { secretSantaIsImpossible: true };
 }

 //JSON response.
 res.setHeader('Content-Type', 'application/json');
 res.send(jsonResponse);

});

app.listen(3000);

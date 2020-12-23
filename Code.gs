function onOpen() {
  var ui = SpreadsheetApp.getUi();
  // Or DocumentApp or FormApp.
  ui.createMenu('Ethicart')
      .addItem('Check for Palm Oil', 'palmOilChecker')
      .addToUi();
}


async function palmOilChecker() {
 var sheet = SpreadsheetApp.getActiveSheet();
 var data = sheet.getDataRange().getValues();
  
 var searchTermCollection = [];
  for (let i = 0; i < data.length; i++){
   searchTermCollection.push(data[i][0]); 
  }
  
  
  
 var responseArray = await performBackEndSearch(searchTermCollection);
 
 
}


async function performBackEndSearch(termArray){
  
  var address = "https://us-central1-ethicart-scraper.cloudfunctions.net/scraper";
  //var address = "https://aqueous-shore-31061.herokuapp.com/scraper";
  var formData = {
    searchTerms: termArray 
  };
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(formData)
  };
  
  Logger.log(options);
  Logger.log("it is updating");
  var response = await UrlFetchApp.fetch(address, options);
  
  Logger.log(response);
  var responseText = response.getContentText();
  var responseJSON = JSON.parse(responseText);
  
  writeResponseToSpreadSheet(responseJSON, termArray);
  
  return response;
}



function writeResponseToSpreadSheet(responses, searchTermCollection){
  var sheet = SpreadsheetApp.getActiveSheet();
  sheet.clear();
  
  console.log(responses);
  
  sheet.appendRow(["Searched Food", "Scraped Item", "Contains Palm Oil"]);
  for (let i = 0; i < searchTermCollection.length; i++){
   sheet.appendRow([searchTermCollection[i], responses[i]["productName"], responses[i]["containsPalmOil"]]); 
  }
  
}

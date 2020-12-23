const functions = require('firebase-functions');
const cors = require("cors")({origin: true});

const cheerio = require("cheerio");
const getUrls = require("get-urls");
const fetch = require("node-fetch");


// Takes the name of a product and returns its url for the tesco store
const performSearch = async (searchTerm) => {
    // first encode the search term and replace spaces with %20
    var encodedSearchTerm = encodeURI(searchTerm);
    const searchUrl = `https://www.tesco.ie/groceries/product/search/default.aspx?searchBox=${encodedSearchTerm}`;

    const res = await fetch(searchUrl);
    const html = await res.text();
    const $ = cheerio.load(html);

    const productUrl = $("div[class=productLists]").find("ul").find("li").find("div").find("h3").find("a").attr("href");
    //.find("ul > li > div > h3 > a").attr("href");
    if (typeof productUrl === "undefined" || productUrl === null){
        return "NULL";
    } else {
        return `https://www.tesco.ie${productUrl.toString()}`;
    }    
}

const performSearchSuperValu = async (searchTerm) => {
    // first encode search term
    var encodedSearchTerm = encodeURI(searchTerm);
    const searchUrl = `https://shop.supervalu.ie/shopping/search/allaisles?q=${encodedSearchTerm}`;

    const res = await fetch(searchUrl);
    const html = await res.text();
    const $ = cheerio.load(html);

    // get the product url of th first search result
    const productUrl = $("div[class=product-list-item-details]").find("a").attr("href");
    
    if (typeof productUrl === "undefined" || productUrl === null){
        return "NULL";
    } else {
        return productUrl;
    }
}

// Take a string of search terms and get all the urls
const performSearches = (searchTerms) => {
    
    const requests = searchTerms.map(async term => {
        return await performSearchSuperValu(term);
    });

    return Promise.all(requests);

}

const scrapeIngredientsSuperValu = (urls) => {
    console.log(urls);
    const requests = urls.map(async url => {
        if (url !== "NULL"){
            const res = await fetch(url);
            const html = await res.text();
            const $ = cheerio.load(html);
            const ingredients = $("div[class=container-semi-fluid]").find("div").find("div").find("p").text();
            const productName = $("h2[class=section-header]").text();
            
            const madeInIreland = $("span[class=product-client-attribute]").find("i").html();
            
            var madeInIrelandBool = madeInIreland !== null;

            return [productName, ingredients.toString(), madeInIrelandBool];

        } else {
            return ["Product could not be found", "", ""];
        }
    });

    return Promise.all(requests);
}


const scrapeIngredients = (urls) => {
    // extract the urls from the text parameter

    console.log(urls);

    const requests = urls.map(async url => {
        
        // request the given website
        if (url !== "NULL"){
            const res = await fetch(url);

            // get the html text from the requested website
            const html = await res.text();
    
            // // set up cheerio for the returned html so it can be queried
            const $ = cheerio.load(html);
    
            var returnArray = [];
    
            const ingredients = $("div[class=content]").text();
    
            const productName = $("div[class=productDetails]").find("h1").text();
    
            const ingredientsText = ingredients.toString();
            return [productName, ingredientsText];
    
        } else {
            return ["Product could not be found", ""];
        }
        
    });


    // perform the given function in the map funct above similtaneously for each of the given urls
    return Promise.all(requests);

}



const flaggedTerms = ["Palm Oil", "Palm"];
const veganNoGoTerms = ["Gelatin", "Honey", "Milk", "Cream", "Egg", "Fish", "Cheese", "Butter", "Beef", "Pork", "Lamb", "Chicken", "Duck"];
/*
* Returns a list of the flagged ingredients that the product contains 
*/
const containsFlaggedIngredients = (ingredientsString) => {
    var flaggedContained = false;
    var veganContained = true;
    flaggedTerms.forEach((term) => {
        if (ingredientsString.search(term) !== -1){
            flaggedContained = true;
        }
    });
    veganNoGoTerms.forEach(term => {
        if (ingredientsString.search(term) !== -1){
            veganContained = false;
        }
    });

    return [flaggedContained, veganContained];
}

/**
 * Checks against the ingredients list to check if there an ingredient considered not vegan
 * 
 * @param {String} ingredientsString 
 */
const isVegan = (ingredientsString) => {
    var flaggedContained = false;
    flaggedTerms.forEach(term => {
        if (ingredientsString.search(term) !== -1){
            flaggedContained = true;
        }
    });

    return flaggedContained;
}


exports.scraper = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {

            if (req.method !== "POST") return res.status(400).json({message: "Unable to process, POST method required"});
            
            const body = req.body;
            functions.logger.log(body);
            const json = body;

            // get the search terms from the sent object
            const searchTerms = json["searchTerms"];
            
            var returnPayload = [];
            
            const searchUrls = await performSearches(searchTerms);

            const data = await scrapeIngredientsSuperValu(searchUrls);
            

            // // now check for flagged ingredients
            var contains = data.map(([productName, ingredients, madeInIreland]) => containsFlaggedIngredients(ingredients));

            var returnObject = [];
            for (let i = 0; i < contains.length; i++){
                returnObject.push({
                    productName: data[i][0],
                    madeInIreland: data[i][2],
                    containsPalmOil: contains[i][0] ,
                    vegan : contains[i][1]
                });
            }

            return res.status(200).send(returnObject);

})});

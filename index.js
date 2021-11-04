const { default: got } = require("got");
const fs = require("fs");
const mongo = require("mongodb").MongoClient;

async function scraper(link, settings) {
     try {
          let itemsObj = [];
          const pagesAmount = await getPagesInfo(link, 1, itemsObj);
          await timeout(settings.timeout);
          console.log(`Scraped page number 1/${pagesAmount}`);

          if (pagesAmount >= 2) {
               for (x = 2; x <= pagesAmount; x++) {
                    await getPagesInfo(link, x, itemsObj);
                    await timeout(settings.timeout);
                    console.log(`Scraped page number ${x}/${pagesAmount}`)
               }
          }

          await addItems(settings.databaseURL, settings.databaseName, settings.collection, itemsObj);
          console.log(`Successfully scraped url: ${link}`);

     } catch (e) {
          console.log(e);
     }
}

async function getPagesInfo(link, indx, itemsObj) {
     try {
          const resp = await got(link.includes("?") ? link + `&offerTypeBuyNow=1&p=${indx}` : link + `?=offerTypeBuyNow=1&p=${indx}`, {
               headers: {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "accept-encoding": "gzip, deflate, br",
                    "accept-language": "en,pl-PL;q=0.9,pl;q=0.8,en-US;q=0.7",
                    "cache-control": "max-age=0",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36",
               },
               timeout: {
                    request: 10000,
                    response: 10000,
               },
          });
          const pages = parseInt(resp.body.match(/(?<=_1h7wt mh36_8 mvrt_8 _3db39_3i0GV _3db39_XEsAE">)(.*?)(?=<\/span>)/m));
          let itemsArr = resp.body.match(/(?<=class="_w7z6o _uj8z7 meqh_en mpof_z0 mqu1_16 _9c44d_2vTdY  " href=")(.*?)(?=m7er_k4 _9c44d_w7AeH)/gm);
          
          // there we scrape every item for exact data and input into mongo DB
          await itemsArr.forEach(item =>scrapeItems(item, itemsObj));
          return pages;
     } catch (error) {
          console.log(error);
          await timeout(10000);
     }
}


function scrapeItems(itemBody, itemsObj) {
     const url = itemBody.match(/(.*?)(?=")/m)[0];
     var name;
     try {
          name = itemBody.match(/(?<=title="" rel="nofollow">)(.*?)(?=<\/a><\/h2><div class=")/m)[0];

     } catch (e) {
          name = itemBody.match(/(?<=title="">)(.*?)(?=<\/a><\/h2><div class=")/m)[0];
     }
     const price = parseFloat(itemBody.match(/(?<=aria-label=")(.*?)(?= zł aktualna cena")/m)[0].replace(" ", "").replace(",", "."));
     let priceShipped = itemBody.match(/(?<=<div class="mqu1_g3">)(.*?)(?= zł z dostawą)/m);
     let amountOfBought = itemBody.match(/(?<=<span class="msa3_z4">)(.*?)(?=<\/span>)/mg);
     
     priceShipped = priceShipped != null ? parseFloat(priceShipped[0].replace(" ", "").replace(",", ".")) : 0;
     amountOfBought = amountOfBought != null ? parseInt(amountOfBought[0].split(" ")[0]) : 0;

     itemsObj.push({
          url,
          name,
          price,
          priceShipped,
          amountOfBought,
     })

}

function addItems(dbUrl, dbName, dbCollection, item) {
     try {
          mongo.connect(dbUrl, (err, db) => {
               if (err) {
                    throw err;
               }
               db.db(dbName).collection(dbCollection).insertMany(item, (err, res) => {
                    if (err) {
                         throw err;
                    }
                    db.close();
               })
               
          });

     } catch (e) {
          console.log(e);
     }

}

function timeout(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
}

function main() {
     const linksList = fs.readFileSync("links.txt", "utf-8").toString().split("\n");
     const settings = JSON.parse(fs.readFileSync("settings.json"));
     for (x = 0; x < linksList.length; x++) {
          if (linksList[x] != "") {
               console.log(`Scraping link: ${linksList[x]}`)
               scraper(linksList[x], settings);
          }
     }
}

main()
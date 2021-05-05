const reader = require('xlsx')
const http = require('http');
const stores = new Map();

const sendRequest = (url, msg) => {
  return new Promise((resolve, reject) => {
    let start = new Date();
    console.log(`Sending request for ${url}`);
    return http.get(url, res => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`${msg}, statusCode: ${res.statusCode}, and took ${Math.round((new Date() - start) / 1000 * 10) / 10} secs`);
      } else {
        console.log(`Not 200: ${res.statusCode}`);
      }
      resolve({
        statusCode: res.statusCode,
        spend: Math.round((new Date() - start) / 1000 * 10) / 10
      })
    }).on("error", (err) => {
      console.log("Error: " + err.message);
      reject({
        statusCode: 500,
        spend: Math.round((new Date() - start) / 1000 * 10) / 10
      });
    });
  });
}

const cacheOn = false;
const cacheStr = '&times' + new Date().getTime() + '=1';
const file = reader.readFile('./files/services.xlsx');
// const api = 'http://172.20.17.108:60016';
const api = 'http://172.20.17.108:60016/v1/data/{service}&clientId=1&permissionId=1' + (!cacheOn ? cacheStr : '');

const sheets = file.SheetNames;

const pools = [];
let count = 0;
for (let i = 0; i < sheets.length; i++) {
  const temp = reader.utils.sheet_to_json(file.Sheets[file.SheetNames[i]])
  temp.forEach(({ Services }) => {
    // if (count > 3) return;
    // count++;
    if (!Services) {
      console.error('no such service');
      return;
    }
    if (stores.get(Services)) {
      console.info(`Exist in store: ${Services}`);
      return;
    }
    stores.set(Services, null);
  })
}

const iter = stores.keys();
const size = stores.size;
let cursor = iter.next();
let count = 0;

async function load() {
  while (!!cursor.value) {
    try {
      const url = api.replace('{service}', cursor.value);
      let msg = `${count}th of ${size}`;
      const { statusCode, spend } = await sendRequest(url, msg);
      stores.set(cursor.value, { status: statusCode, spend: spend });
    } catch (error) {
      console.error('Fail on request');
      stores.set(cursor.value, { status: 500, spend: 0 });
    } finally{
      count++;
      cursor = iter.next();
      console.log(``)
    }
  }

  const writableData = [];
  stores.forEach((value, key) => {
    writableData.push({
      service: key,
      status: value.status,
      time: value.spend
    });
  });

  const ws = reader.utils.json_to_sheet(writableData)

  reader.utils.book_append_sheet(file, ws, new Date().getTime().toString())

  // Writing to our file
  reader.writeFile(file,'./files/services.xlsx')

  console.log(writableData);
}


load().catch(e=>console.error(e));





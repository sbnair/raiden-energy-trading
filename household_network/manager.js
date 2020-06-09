const express = require('express');
const app = express();
const fileUpload = require("express-fileupload")
const serverport = process.env.PORT || 9000;

const fs = require('fs');
const yaml = require('js-yaml');
const Web3 = require('web3');
const Transaction = require('ethereumjs-tx').Transaction;
const child_process = require('child_process')
//var accounts = require('./network/accounts.json');
var EC = require('elliptic').ec;
const { SHA3 } = require('sha3');

const Wallet = require('ethereumjs-wallet')
const createKeccakHash = require('keccak')
const cron = require('node-cron');

var $ = jQuery = require('jquery');




const axios = require('axios');
const bodyParser = require('body-parser');

const solc = require('solc');
const keythereum = require("keythereum");
const log = require('ololog').configure({ time: true });
const ansi = require('ansicolor').nice

require('dotenv').config()

app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(express.json());
app.use(bodyParser.json());
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

/*start*/
const addr = getManagerAddress();
const privKey = getPrivKey("1234");
const tkn = "0x4A077a9dd42726E722eF167c9363EEC318e40182";
const contractaddr = "0xcc77c453471c00af35d08f0103991cc604adf5a2";
const rpcUrl = "https://goerli.infura.io/v3/568d1aa1488f4d3ca4be7ba148703e01";
const nettingAddr = "0x18e663C2238cdB011e75d4c1E19910499259667A";

/*
returns a checksummed address from any ethereum address
very importent to read keyfile.json and get address
*/
function getManagerAddress() {
    //get keyfiles
    let keystores = fs.readdirSync("./data/keystore");

    //get the address from the first keyfile of keystore
    let json = JSON.parse(fs.readFileSync("./data/keystore/" + keystores[0]));
    let address = json.address.toLowerCase().replace('0x','');

    //hashing address
    let web3 = new Web3();
    var hash = web3.utils.sha3(address).replace('0x', '');

    var res = '0x';
    for(i in address){
      if(parseInt(hash[i]) < 8){
        res += address[i]
      }else{
        res += address[i].toUpperCase();
      }
    }
    return res
};

/*
returns the private key from the first keyfile of keystore
*/
function getPrivKey(password){
  //get private key with password
  try {
    var keyObject = keythereum.importFromFile(addr.toLowerCase(), "./data");
    var privateKey = keythereum.recover(password, keyObject);
  } catch (e) {
    console.log(e)
  }

  return privateKey.toString("hex");


}

/*
start server
*/
app.listen(serverport, () => {
    console.log(addr + ` listening on port ${serverport}`);
});

/*running a function every minute
  checks if 15 minutes are over to send every 0, 15, 30, 45 minutes*/
cron.schedule('* * * * *', () => {
    let minutes = [0, 15, 30, 45]
    let date = new Date();
    console.log(date.getMinutes());
    if(minutes.includes(date.getMinutes())){
	     console.log("sending phase");
	     doPayment();
    }
});

/*
opens a payment channel with the netting server
*/
async function openChannel(){
  let accounts = getAllAccounts();
  for(account of accounts){
    let reqCheck = account.api + "channels/" + tkn + "/" + nettingAddr;
    let resCheck = await axios.get(reqCheck, data);

    if(resCheck.status != 200){
      let req = account.api + "channels";
      let data = {
  	     "partner_address": netserver,
  	     "token_address": tkn,
  	     "total_deposit": "10000000000000000000",
  	     "settle_timeout": "500"
      };

      axios.put(req, data).then(
  	    response => {
  		      console.log(response.data)
  	    }
  	  ).catch(err => {console.log(err)})
    }
  }
}

/*
send smart meter data to netting server
*/
async function doPayment(){
  let accounts = getAllAccounts();
  for(account of accounts){
    let reqCheck = account.api + "channels/" + tkn + "/" + nettingAddr;
    let resCheck = await axios.get(reqCheck, data);

    if(resCheck.status == 200){
      let req = account.api + 'payments/' + tkn + "/" + nettingAddr;
      let data = {
        "amount": "1",
        "identifier": Math.floor((Math.random() * 2) + 1) + "50"
      };

      axios.post(req, data).then(
        response => {
          console.log(response.data)
        }
      ).catch(err => {console.log(err)})
    }
  }
}

/*
returns array with all accounts with address, api and networkid
*/
function getAllAccounts(){
  var res = [];
  networkcount = countNetwork();

  let addresses = [];
  //iterate over all networkids
  for(let i = 0; i < networkcount; i++){
    let keyfiles = fs.readdirSync("./network" + i + "/data/keystore")
    let addresses = [];
    //get all addresses from keyfiles
    for(keyfile of keyfiles){
      let json = JSON.parse(fs.readFileSync("network" + i + "/data/keystore/" + keyfile));
      addresses.push(checksummed(json.address));
    }

    //get api for all addresses of the network with networkid = i
    let doc = yaml.safeLoad(fs.readFileSync("./network" + i + "/docker-compose.yml", "utf8"));
    for(address of addresses){
      let ymlvalue = doc.services["raiden_" + address.toLowerCase()];
      //get ip
      let ip = ymlvalue.networks["raiden_net_" + i].ipv4_address;

      //get port
      let index = ymlvalue.command.indexOf("0.0.0.0:") + 8;
      let port = "";
      for(let i = index; i < ymlvalue.command.length; i++){
        if(ymlvalue.command[i] == " " | ymlvalue.command[i] == "\n" | ymlvalue.command[i] == "\t"){
          break
        }else{
          port += ymlvalue.command[i];
        }
      }
      let api = "http://" + ip + ":" + port + "/api/v1/";
      res.push({"address": address, "api": api, "networkid": i});
    }
  }
  return res;
}

/*
adds n networks
*/
function addNetwork(n){

  unused = fs.readdirSync("./unused");
  for(network of unused){
    if(n <= 0){
      break;
    }
    fs.renameSync("./unused/" + network, "./" + network);
    n--;
  }

  networkCount = countNetwork();
  for(n; n > 0; n--){
    if(networkCount >= 12){
      console.log("only 12 networks where allowed. Networks set to maximum")
      return
    }
    fs.mkdirSync("./network" + networkCount);
    fs.mkdirSync("./network" + networkCount + "/data")
    fs.writeFileSync("./network" + networkCount + "/data/password.txt", "1234");
    fs.writeFileSync("./network" + networkCount + "/docker-compose.yml");
    fs.copyFileSync("./data/Dockerfile", "./network" + networkCount + "/Dockerfile")
    for(let i = 0; i < 5; i++){
      child_process.execSync("geth account new --datadir ./network" + networkCount + "/data --password ./network" + networkCount + "/data/password.txt");
    }
    writeDockerCompose(networkCount)
    networkCount++;
  }
}

/*
  removes n networks
  networks are moved to unused and removed from use
*/

function removeNetwork(n){
  networkcount = countNetwork();
  if(n > networkcount){
    console.log("not so many accounts available");
    return false;
  }

  for(let i = networkcount - 1; n > 0; i--, n--){

    child_process.execSync("cd network" + i + "; docker-compose down");
    fs.renameSync("./network" + i, "./unused/network" + i);

  }
  console.log("removed " + n + " accounts");
}


/*write the docker-compose.yml for every used account
  create 1 network for 5 accounts
  write the api for an account in accounts.json*/
function writeDockerCompose(networkCount){
  let res = "version: '3'\nnetworks:\n";
    res +=
    "  raiden_net_" + networkCount + ":\n" +
          "    driver: bridge\n" +
          "    ipam:\n" +
            "      driver: default\n" +
            "      config:\n" +
            "      - subnet: 172." + networkCount + ".144.0/16\n\n";

  res += "services:\n";


  keyfiles = fs.readdirSync("./network" + networkCount + "/data/keystore");
  fs.writeFileSync("./network" + networkCount + "/apiEndpoints.json", "[]");
  let accounts = JSON.parse(fs.readFileSync("./network" + networkCount + "/apiEndpoints.json"))
  let netid = 5;
  for(keyfile of keyfiles){
    let api = "http://172." + networkCount + ".144." + netid + ":5001/api/v1/";
    let address = checksummed(JSON.parse(fs.readFileSync("./network" + networkCount + "/data/keystore/" + keyfile)).address);
    accounts.push({address, api});
    res +=
    "  raiden_" + address.toLowerCase() + ": \n" +
    			"    build:\n" +
          			"      context: . \n" +
          			"      dockerfile: ./Dockerfile \n" +
        			"    volumes: \n" +
          				"      - './data:/data' \n" +
        			"    networks: \n" +
          				"      raiden_net_" + networkCount + ": \n" +
            				"        ipv4_address: '172." + networkCount + ".144." + netid + "' \n" +
        			"    command: \n" +
          				"      --keystore-path ./data/keystore \n" +
          				"      --network-id goerli \n" +
          				"      --eth-rpc-endpoint " + rpcUrl + " \n" +
          				"      --gas-price fast \n" +
          				"      --environment-type development \n" +
         				"      --api-address 0.0.0.0:5001 \n" +
         				"      --accept-disclaimer \n" +
         				"      --address '" + address + "' \n" +
          				"      --password-file ./data/password.txt\n" +
    					"      --web-ui\n\n";

      netid++
  }
  fs.writeFileSync("./network" + networkCount + "/apiEndpoints.json", JSON.stringify(accounts));
  fs.writeFileSync("./network" + networkCount + "/docker-compose.yml", res);
}

/*
  sends 0.01 testether to each used account when balance < 0.01
*/
async function sendEther(){
  let web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  var amount = await web3.utils.numberToHex(web3.utils.toWei('0.01', 'ether'));
  balance_manager = await web3.utils.fromWei( await web3.eth.getBalance(addr));
  console.log("balance manager: " + balance_manager);
  var accounts = getAllAccounts();
  for(account of accounts){
    console.log(account.address + ": " + await web3.utils.fromWei(await web3.eth.getBalance(account.address)))
    if(await web3.utils.fromWei(await web3.eth.getBalance(account.address)) >= 0.01){
      continue;
    }
    try{
      let gasPrice = await web3.eth.getGasPrice();
      let nonce = await web3.eth.getTransactionCount(addr);

      let data = {
        from: addr,
        to: account.address,
        gasPrice: await web3.utils.toHex(gasPrice),
        gas: web3.utils.toHex(8000000),
        nonce: web3.utils.toHex(nonce),
        value: amount,
        chainId: '0x05'
      };

      //create new transaction and sign
      let transaction = new Transaction(data, {chain: "goerli"});
      let bufferedKey = Buffer.from(privKey, "hex");
      transaction.sign(bufferedKey);

      //send transaction
      let serializedTx = transaction.serialize();
      await web3.eth.sendSignedTransaction("0x" + serializedTx.toString("hex"));
      console.log("send 0.01 goerli ether to " + account.address);
    } catch(err){
    sendEther();
    }
  }
}

//tokennetwork request start
/*
  if a raiden client has not allready joined the tokennetwork, then mint tokens and join the tokennetwork
*/
async function checkTokenNetwork(){
  let accounts = getAllAccounts();
  for(account of accounts){
    try {
      x = await axios.get(account.api + "connections");
      if(!x.data.hasOwnProperty(tkn)){
        mintAndJoinToken(account.address);
      }else{
        console.log(account.address + " allready joined")
      }
    } catch (e) {
      console.log(account.address + " not online")
    }
  }
}

/*
  mints token for every used account
  if succesfully minted some tokens, then join the tokennetwork
*/

function mintAndJoinToken(addr){
  let accounts = getAllAccounts();
  for (account of accounts){
    if(account.address == addr){
      let connect = account.api + "_testing/tokens/" + tkn + "/mint";
      let data = {
  	     "to": account.address,
  	      "value": 51000000000000000000
      };

      axios.post(connect, data).then(
  	    response => {
  		      console.log(addr + " minted tokens")
            joinTokennetwork(addr);
  	    }
  	  ).catch(err => {console.log(addr + ": minting failed")});
      break;
    }
  }
}

/*
  join the tokennetwork
*/
function joinTokennetwork(addr){
  let accounts = getAllAccounts();
  for(account of accounts){
    if(account.address == addr){
      let connect = account.api + "connections/" + tkn;
      let data = {
  	     "funds":50000000000000000000
      };

      axios.put(connect, data).then(
  	    response => {
  		      console.log(addr + " joined tokennetwork");
  	    }
  	).catch(err => {console.log(addr + ": join tokennetwork failed")});
    break;
    }

  }
}
//tokennetwork requests end

/*
  checks if all used clients have an open payment channel with the netting server
  @param open = boolean. if no open payment channel -> join or not (true, false)
*/
async function checkPaymentChannel(join){
  let accounts = getAllAccounts();
  for(account of accounts){
    try {
      response = await axios.get(account.api + "channels/" + tkn + "/" + nettingAddr);
      console.log(response.data)
    } catch (e) {
      if(join && e.response.status == 404){

      }
    }

  }
}

/*
  return and print all used accounts
*/
function getUsedAccounts(){
  let accounts = getAllAccounts();
  let res = [];
  for(account of accounts){
    console.log(account);
    res.push(account);
  }
  console.log("\n" + res.length);
  return res
}

/*
  checks if all used raiden clients are online
*/
async function checkOnline(){
  let accounts = getAllAccounts();
  let res = [];
  for(account of accounts){
    try {
      response = await axios.get(account.api + "status", {timeout: 500});
      if(response.status == 200 && response.data.status == "ready"){
        res.push({"address": account.address, "api": account.api, "networkid": account.networkid, "status": "online"})
      }else if(response.status == 200 && response.data.status == "unavailable" ){
        res.push({"address": account.address, "api": account.api, "networkid": account.networkid, "status": "syncing"})
      }else{
        res.push({"address": account.address, "api": account.api, "networkid": account.networkid, "status": "offline"})
      }
    } catch (e) {
      res.push({"address": account.address, "api": account.api, "networkid": account.networkid, "status": "offline"})
    }
  }
  return res;
}

async function test(){
  try {
    x = await axios.get(accounts.used[0].api + "address")
    console.log(x.data.our_address)
  } catch (e) {
    console.log(e)
  }
}

/*
returns a checksummed address from any ethereum address
very importent to read keyfile.json and get address
*/
function checksummed(address) {
    let web3 = new Web3();
    address = address.toLowerCase().replace('0x','');
    var hash = web3.utils.sha3(address).replace('0x', '');
    var res = '0x';

    for(i in address){
      if(parseInt(hash[i]) < 8){
        res += address[i]
      }else{
        res += address[i].toUpperCase();
      }
    }
    return res
}

function countNetwork(){
  data = fs.readdirSync("./");
  count = 0;
  for(i in data){
    if(data[i].includes("network")){
      count++;
    }
  }
  return count;
}

/*
starts the specific raiden network with networkid
if networkid = -1 starts all raiden networks
*/
async function startRaidennetwork(networkid){
  counter = countNetwork();
  if(networkid != -1  && networkid < counter){
    await child_process.execSync("cd network" + networkid + "; docker-compose down");
    child_process.exec("gnome-terminal --title='network'" + networkid + " -x sh -c 'cd network" + networkid + "; docker-compose up'");
  }else if(networkid == -1){
    for(let i = 0; i < counter; i++){
      startRaidennetwork(i);
    }
  }
}

/*
stops the specific raiden network with networkid
if networkid = -1 stops all raiden networks
*/
async function stopRaidenNetwork(networkid){
  counter = countNetwork();
  if(networkid != -1  && networkid < counter){
    child_process.exec("cd network" + networkid + "; docker-compose down");
  }else if(networkid == -1){
    for(let i = 0; i < counter; i++){
      stopRaidenNetwork(i);
    }
  }
}

/*
---------------server api begin---------------
*/

app.use(express.static("data"));
app.use(fileUpload());

app.get('/', function (req,res) {
  getAllAccounts();
  res.sendFile(__dirname + '/data/index.html');
});

app.get("/allAccounts", async function (req, res) {
  let checkedAccounts = await checkOnline();
  res.send(checkedAccounts);
});

app.post("/startServices", function (req, res){
  networkid = req.body.networkid
  startRaidennetwork(networkid);
  res.send("ok")
});

app.post("/stopServices", function (req, res){
  networkid = req.body.networkid
  console.log("stop")
  stopRaidenNetwork(networkid);
  res.send("ok")
});

app.post("/addNetwork", function (req, res){
  n = req.body.n
  if(n == undefined | isNaN(n)){
    res.send("n is not a number")
  }else{
    console.log("add " + n + " networks")
    addNetwork(n);
  }

  res.send("ok")
});

app.post("/removeNetwork", function (req, res){
  n = req.body.n
  if(n == undefined | isNaN(n)){
    res.send("n is not a number")
  }else{
  console.log("remove " + n + " networks")
  removeNetwork(n);
  }
  res.send("ok")

});
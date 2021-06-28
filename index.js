require("dotenv").config()
var mongoose = require("mongoose");
var colors = require("colors");
var cron = require('node-cron');
var async = require("async");
var bodyParser = require("body-parser");
var express = require("express");
var cors = require("cors");
var morgan = require("morgan");
var http = require("http");

const Telegram = require('telegram-notify');
const { exec } = require("child_process");
const UnrelayPacket = require("./schema.js");
var { getStats } = require("./controller.js");

const MONGOURL = process.env.MONGOURL
const DBNAME = process.env.DBNAME
const PORT = process.env.PORT || 3000
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const PACKETS_THRESHOLD = parseInt(process.env.PACKETS_THRESHOLD)

let pathDetails = [
    {
        pathName: "akash-osmosis",
        pathDir: "~/.rly-akash",
        srcName: "akash",
        dstName: "osmosis"
    },
    {
        pathName: "cosmos-osmosis",
        pathDir: "~/.rly-cosmos",
        srcName: "cosmos",
        dstName: "osmosis"
    },
    {
        pathName: "sentinel-osmosis",
        pathDir: "~/.rly-sentinel",
        srcName: "sentinel",
        dstName: "osmosis"
    },
    {
        pathName: "regen-osmosis",
        pathDir: "~/.rly-regen",
        srcName: "regen",
        dstName: "osmosis"
    },
    {
        pathName: "iris-osmosis",
        pathDir: "~/.rly-iris",
        srcName: "iris",
        dstName: "osmosis"
    },
    {
        pathName: "core-osmosis",
        pathDir: "~/.rly-core",
        srcName: "core",
        dstName: "osmosis"
    },
    {
        pathName: "crypto-osmosis",
        pathDir: "~/.rly-crypto",
        srcName: "crypto",
        dstName: "osmosis"
    },
]

// let pathDetails = [
//     {
//         pathName: "demo",
//         pathDir: "~/.relayer",
//         srcName: "ibc-0",
//         dstName: "ibc-1"
//     }
// ]

const uri = `${MONGOURL}/${DBNAME}`
let notify = new Telegram({ token: TELEGRAM_TOKEN, chatId: TELEGRAM_CHAT_ID });
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (error, result) => {
    if (error) {
        console.log('Error in connecting to DB');
        throw error;
    } else {
        console.log(colors.green('\n****** Database is connected *****'))
        console.log(colors.green('URI :', MONGOURL))
        console.log(colors.green('DATABASE_NAME :', DBNAME))
        console.log(colors.green('*****************************************************************\n\n'))
        var app = express();
        app.use(bodyParser.json())
        app.use(cors())
        app.use(morgan("combined"));
        var server = http.createServer(app);
        app.get("/", (req, res) => {
            res.status(200).send({
                success: true,
                status: "UP",
            })
        })

        app.get("/stats", getStats)

        console.log(colors.green("\n********** Server is up **********"))
        console.log(colors.green("PORT :", PORT))
        console.log(colors.green("**********************************\n"))
        server.listen(PORT);

        cron.schedule('*/1 * * * *', () => {
            console.log('Running cron job at ', new Date());
            async.each(pathDetails, (path, cb) => {
                executeCommand(path, 0, () => {
                    cb();
                });
            }, (err) => {
            })
        });
    }
})

function executeCommand(path, retryCount, callback) {
    let command = `rly q unrelayed-packets ${path.pathName} --home ${path.pathDir}`
    setTimeout(() => { }, 1000);
    exec(command, (err, stdout, stderr) => {
        let time = new Date();
        if (err || stderr) {
            console.log(`Got error: ${err.message} at ${time}`);
            if (retryCount < 3) {
                console.log("Retrying again....");
                retryCount++;
                executeCommand(path, retryCount, () => {
                    callback();
                });
            } else {
                callback();
            }
        } else {
            let parsedData = {};
            try {
                parsedData = JSON.parse(stdout);
                let data = {
                    pathName: path.pathName,
                    time: time,
                    srcPacketsCount: parsedData.src && parsedData.src.length || 0,
                    dstPacketsCount: parsedData.dst && parsedData.dst.length || 0,
                    srcData: parsedData.src || [],
                    dstData: parsedData.dst || []
                }
                if (data.srcPacketsCount > PACKETS_THRESHOLD) {
                    notify.send(`Unrelayed packets count of ${path.srcName} chain in ${path.pathName} path is greater than ${PACKETS_THRESHOLD}.
Unrelayed packets are ${data.srcData.join(",")}`)
                        .then(() => { })
                        .catch((e) => { console.log("Error when alerting...", e); })
                }
                if (data.dstPacketsCount > PACKETS_THRESHOLD) {
                    notify.send(`Unrelayed packets count of ${path.dstName} chain in ${path.pathName} path is greater than ${PACKETS_THRESHOLD}.
Unrelayed packets are ${data.dstData.join(",")}`)
                        .then(() => { })
                        .catch((e) => { console.log("Error when alerting...", e); })
                }
                let instance = new UnrelayPacket(data);
                instance.save((err) => {
                    if (err) {
                        console.log(`Error when storing into db: ${err}`)
                        if (retryCount < 3) {
                            console.log("Retrying again....");
                            retryCount++;
                            executeCommand(path, retryCount, () => {
                                callback();
                            });
                        } else {
                            callback();
                        }
                    } else {
                        console.log("Updated into db of path:", path.pathName, " at ", time);
                        callback();
                    }
                })
            } catch (e) {
                console.log(`Error when parsing json: ${e}`)
                if (retryCount < 3) {
                    console.log("Retrying again....");
                    retryCount++;
                    executeCommand(path, retryCount, () => {
                        callback();
                    });
                } else {
                    callback();
                }
            }
        }
    })
}

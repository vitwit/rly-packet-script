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

const { exec } = require("child_process");
const UnrelayPacket = require("./schema.js");
var { getStats } = require("./controller.js");

const MONGOURL = process.env.MONGOURL
const DBNAME = process.env.DBNAME
const PORT = process.env.PORT || 3000

let pathDetails = [
    {
        pathName: "akash-osmosis",
        pathDir: "~/.rly-akash"
    },
    {
        pathName: "cosmos-osmosis",
        pathDir: "~/.rly-cosmos"
    },
    {
        pathName: "sentinel-osmosis",
        pathDir: "~/.rly-sentinel"
    },
    {
        pathName: "regen-osmosis",
        pathDir: "~/.rly-regen"
    },
    {
        pathName: "iris-osmosis",
        pathDir: "~/.rly-iris"
    },
    {
        pathName: "core-osmosis",
        pathDir: "~/.rly-core"
    },
    {
        pathName: "crypto-osmosis",
        pathDir: "~/.rly-crypto"
    },
]

// let pathDetails = [
//     {
//         pathName: "demo",
//         pathDir: "~/.relayer"
//     }
// ]

const uri = `${MONGOURL}/${DBNAME}`
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

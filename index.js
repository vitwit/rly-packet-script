require("dotenv").config()
var mongoose = require("mongoose");
var colors = require("colors");
var cron = require('node-cron');
const { exec } = require("child_process");
const UnrelayPacket = require("./schema.js");

const MONGOURL = process.env.MONGOURL
const DBNAME = process.env.DBNAME
var command = process.env.COMMAND


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
        cron.schedule('*/1 * * * *', () => {
            console.log('Running cron job at ', new Date());
            executeCommand(0);
        });
    }
})

function executeCommand(retryCount) {
    exec(command, (err, stdout, stderr) => {
        let time = new Date();
        if (err || stderr) {
            console.log(`Got error: ${err.message} at ${time}`);
            if (retryCount < 3) {
                console.log("Retrying again....");
                retryCount++;
                executeCommand(retryCount);
            }
        } else {
            let parsedData = JSON.parse(stdout) ? JSON.parse(stdout) : {}
            let data = {
                time: time,
                srcPacketsCount: parsedData.src && parsedData.src.length || 0,
                dstPacketsCount: parsedData.dst && parsedData.dst.length || 0,
                output: stdout,
            }
            let instance = new UnrelayPacket(data);
            instance.save((err) => {
                if (err) {
                    console.log(`Error when storing into db: ${err}`)
                    if (retryCount < 3) {
                        console.log("Retrying again....");
                        retryCount++;
                        executeCommand(retryCount);
                    }
                } else {
                    console.log("Updated into db at ", time);
                }
            })
        }
    })
}

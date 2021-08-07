var UnrelayedModel = require("./schema.js");
const { pathDetails } = require("./constants.js");

const rax = require("retry-axios");
const axios = require('axios');
var async = require('async');
const interceptorId = rax.attach();
const lodash = require('lodash');

const raxConfig = {
    retry: 3,
    noResponseRetries: 2,
    retryDelay: 100,
    httpMethodsToRetry: ["GET", "HEAD", "OPTIONS"],
    statusCodesToRetry: [
        [100, 199],
        [429, 429],
        [500, 599]
    ],
    backoffType: "exponential"
};


const getStats = (req, res) => {
    let { query } = req
    let filters = {}
    if (query.path) {
        filters["pathName"] = query.path;
    }

    if (query.start_date) {
        filters.time = filters.time || {};
        filters["time"]["$gte"] = new Date(query.start_date)
    }

    if (query.end_date) {
        filters.time = filters.time || {};
        filters["time"]["$lte"] = new Date(query.end_date)
    }

    UnrelayedModel.find(filters, {}, { sort: { time: 1 } }, (err, data) => {
        if (err) {
            res.status(500).send({
                success: false,
                message: "Error when fetching data",
                error: err
            })
        } else {
            res.status(200).send({
                success: true,
                data: data
            })
        }

    })
}

const getRelayedPackets = (req, res) => {
    let { query, params } = req
    let obj = pathDetails.find(x => x.pathName == params.path)
    if (!obj) {
        res.status(400).send({
            success: false,
            message: "Invalid path",
            error: true
        })
        return;
    }
    let fromOsmosisLimit = query.fromLimit || 100;
    let fromOsmosisOffset = query.fromOffset || 0;
    let toOsmosisLimit = query.toLimit || 100;
    let toOsmosisOffset = query.toOffset || 0;
    let fromOrderBy = query.fromOrderBy || 2;
    let toOrderBy = query.toOrderBy || 2;
    let out = {
        pagination: {}
    };
    async.waterfall([
        (next) => {
            getRelayedTxs(obj.srcLcd, obj.dstChannel, obj.srcChannel, fromOsmosisLimit, fromOsmosisOffset, fromOrderBy, (err, data) => {
                if (err) {
                    next(err);
                } else {
                    next(null, data);
                }
            })
        }, (srcTxs, next) => {
            getRelayedTxs(obj.dstLcd, obj.srcChannel, obj.dstChannel, toOsmosisLimit, toOsmosisOffset, toOrderBy, (err, data) => {
                if (err) {
                    next(err);
                } else {
                    next(null, srcTxs, data);
                }
            })
        }, (srcTxs, dstTxs, next) => {
            out.pagination.totalFromPackets = srcTxs.pagination.total;
            out.pagination.totalToPackets = dstTxs.pagination.total;
            formatTxs(srcTxs, obj.dstName, obj.srcName, obj.dstChannel, obj.srcChannel, (data) => {
                out.from_osmosis_packets = data;
                next(null, dstTxs);
            })
        }, (dstTxs, next) => {
            formatTxs(dstTxs, obj.srcName, obj.dstName, obj.srcChannel, obj.dstChannel, (data) => {
                out.to_osmosis_packets = data;
                next(null);
            })
        },
    ], (err) => {
        if (err) {
            res.status(400).send({
                success: false,
                message: err.message || "Got error",
                error: true
            })
        } else {
            res.status(200).send({
                success: true,
                data: out
            })
        }
    });
}

function getRelayedTxs(url, srcChannel, dstChannel, limit, offset, orderBy, cb) {
    let reqUrl = `${url}/cosmos/tx/v1beta1/txs?events=recv_packet.packet_src_channel='${srcChannel}'&events=recv_packet.packet_dst_channel='${dstChannel}'`
    reqUrl = limit != 100 ? `${reqUrl}&pagination.limit=${limit}` : reqUrl;
    reqUrl = offset ? `${reqUrl}&pagination.offset=${offset}` : reqUrl;
    reqUrl = orderBy ? `${reqUrl}&order_by=${orderBy}` : reqUrl;
    axios({
        method: "get",
        url: reqUrl,
        raxConfig
    })
        .then(resp => {
            cb(null, resp.data || null);
        })
        .catch(err => {
            cb(err, null);
        });
}

function formatTxs(txs, srcChain, dstChain, srcChannel, dstChannel, cb) {
    let data = [];
    async.eachSeries(txs.tx_responses, (tx, next) => {
        let obj = {
            from: srcChain,
            to: dstChain,
            time: tx.timestamp,
            height: tx.height,
            hash: tx.txhash,
            code: tx.code,
            packets: [],
        }
        if (tx.logs.length) {
            async.each(tx.logs, (log, callback) => {
                if (log.events && log.events.length) {
                    let recvPacket = log.events.find(x => x.type == "recv_packet");
                    if (recvPacket) {
                        let packetDataObj = recvPacket.attributes.find(x => x.key == "packet_data")
                        if (packetDataObj) {
                            try {
                                let packetData = JSON.parse(packetDataObj.value);
                                let packet = {};
                                packet.amount = packetData.amount || "";
                                packet.denom = packetData.denom || "";
                                packet.fromAddr = packetData.sender || "";
                                packet.toAddr = packetData.receiver || "";
                                packet.sequence = recvPacket.attributes.find(x => x.key == "packet_sequence").value || "";
                                packet.srcChannel = srcChannel;
                                packet.dstChannel = dstChannel;
                                obj.packets.push(packet);
                                callback();
                            } catch (e) {
                                console.log("JSON parse error...", e);
                                callback();
                            }
                        } else {
                            callback();
                        }
                    } else {
                        callback();
                    }
                } else {
                    callback();
                }
            }, () => {
                data.push(obj);
                next();
            })
        } else {
            data.push(obj);
            next();
        }
    }, () => {
        cb(data);
    })
}

const getUnrelayedPackets = (req, res) => {
    let { params } = req
    let obj = pathDetails.find(x => x.pathName == params.path)
    if (!obj) {
        res.status(400).send({
            success: false,
            message: "Invalid path",
            error: true
        })
        return;
    }
    let out = {
    };
    async.waterfall([
        (next) => {
            getPacketCommitments(obj.srcLcd, obj.srcChannel, [], true, "", (err, data) => {
                if (err) {
                    next(err);
                } else {
                    next(null, data);
                }
            })
        }, (srcPackets, next) => {
            if (srcPackets.length) {
                getUnreceivedPackets(obj.srcLcd, obj.dstLcd, obj.srcChannel, obj.dstChannel, srcPackets.join(","), (err, data) => {
                    if (err) {
                        next(err);
                    } else {
                        next(null, data);
                    }
                })
            } else {
                next(null, []);
            }
        }, (txs, next) => {
            formatSendTxs(txs, obj.srcName, obj.dstName, (data) => {
                next(null, data);
            })
        }, (srcTxs, next) => {
            getPacketCommitments(obj.dstLcd, obj.dstChannel, [], true, "", (err, data) => {
                if (err) {
                    next(err);
                } else {
                    next(null, srcTxs, data);
                }
            })
        }, (srcTxs, dstPackets, next) => {
            if (dstPackets.length) {
                getUnreceivedPackets(obj.dstLcd, obj.srcLcd, obj.dstChannel, obj.srcChannel, dstPackets.join(","), (err, data) => {
                    if (err) {
                        next(err);
                    } else {
                        next(null, srcTxs, data);
                    }
                })
            } else {
                next(null, srcTxs, []);
            }
        }, (srcTxs, dstData, next) => {
            formatSendTxs(dstData, obj.dstName, obj.srcName, (dstTxs) => {
                out = lodash.sortBy(srcTxs.concat(dstTxs), x => new Date(x.time)).reverse();
                next(null);
            })
        },
    ], (err) => {
        console.log("Err..", err);
        if (err) {
            res.status(400).send({
                success: false,
                message: err.message || "Got error",
                error: true
            })
        } else {
            res.status(200).send({
                success: true,
                data: out
            })
        }
    });
}

function getPacketCommitments(url, channel, packets, initial, nextKey, cb) {
    let reqUrl = `${url}/ibc/core/channel/v1beta1/channels/${channel}/ports/transfer/packet_commitments?pagination.limit=100`
    reqUrl = !initial ? `${reqUrl}&pagination.key=${encodeURIComponent(nextKey)}` : reqUrl;

    axios({
        method: "get",
        url: reqUrl,
        raxConfig
    })
        .then(resp => {
            if (resp.data && resp.data.commitments && resp.data.commitments.length) {
                let seqs = resp.data.commitments.map(x => x.sequence);
                packets = packets.concat(seqs);
                if (resp.data.pagination && resp.data.pagination.next_key) {
                    getPacketCommitments(url, channel, packets, false, resp.data.pagination.next_key, (err, data) => {
                        cb(err, data);
                    })
                } else {
                    cb(null, packets);
                }
            } else {
                cb(null, packets);
            }
        })
        .catch(err => {
            cb(err, packets);
        });
}

function getUnreceivedPackets(srcLcd, dstLcd, srcChannel, dstChannel, sequences, cb) {
    let reqUrl = `${dstLcd}/ibc/core/channel/v1beta1/channels/${dstChannel}/ports/transfer/packet_commitments/${sequences}/unreceived_packets`;

    axios({
        method: "get",
        url: reqUrl,
        raxConfig
    })
        .then(resp => {
            if (resp.data && resp.data.sequences && resp.data.sequences.length) {
                let data = [];
                async.each(resp.data.sequences, (seq, callback) => {
                    let txUrl = `${srcLcd}/cosmos/tx/v1beta1/txs?events=send_packet.packet_dst_channel='${dstChannel}'&events=send_packet.packet_src_channel='${srcChannel}'&events=send_packet.packet_sequence='${seq}'`
                    axios({
                        method: "get",
                        url: txUrl,
                        raxConfig
                    })
                        .then(res => {
                            if (res.data && res.data.tx_responses && res.data.tx_responses.length) {
                                let obj = res.data.tx_responses[0];
                                obj.packetSeq = seq;
                                data.push(obj);
                                callback();
                            } else {
                                callback();
                            }
                        })
                        .catch((err) => {
                            callback(err);
                        })
                }, (err) => {
                    if (err) {
                        cb(err, []);
                    } else {
                        cb(null, data);
                    }
                })
            } else {
                cb(null, []);
            }
        })
        .catch(err => {
            cb(err, []);
        });
}

function formatSendTxs(txs, srcName, dstName, cb) {
    let data = [];
    async.eachSeries(txs, (tx, next) => {
        let obj = {
            from: srcName,
            to: dstName,
            time: tx.timestamp,
            height: tx.height,
            hash: tx.txhash,
            code: tx.code,
        }
        if (tx.logs.length) {
            async.each(tx.logs, (log, callback) => {
                if (log.events && log.events.length) {
                    let sendPacket = log.events.find(x => x.type == "send_packet");
                    if (sendPacket) {
                        let correctPacket = sendPacket.attributes.find(x => x.value == tx.packetSeq);
                        if (correctPacket) {
                            let packetDataObj = sendPacket.attributes.find(x => x.key == "packet_data")
                            if (packetDataObj) {
                                try {
                                    let packetData = JSON.parse(packetDataObj.value);
                                    obj.amount = packetData.amount || "";
                                    obj.denom = packetData.denom || "";
                                    obj.fromAddr = packetData.sender || "";
                                    obj.toAddr = packetData.receiver || "";
                                    obj.sequence = sendPacket.attributes.find(x => x.key == "packet_sequence").value || "";
                                    obj.srcChannel = sendPacket.attributes.find(x => x.key == "packet_src_channel").value || "";
                                    obj.dstChannel = sendPacket.attributes.find(x => x.key == "packet_dst_channel").value || "";
                                    callback();
                                } catch (e) {
                                    console.log("JSON parse error...", e);
                                    callback();
                                }
                            } else {
                                callback();
                            }
                        } else {
                            callback();
                        }
                    } else {
                        callback();
                    }
                } else {
                    callback();
                }
            }, () => {
                data.push(obj);
                next();
            })
        } else {
            data.push(obj);
            next();
        }
    }, () => {
        cb(data);
    })
}

module.exports = {
    getStats,
    getRelayedPackets,
    getUnrelayedPackets
}
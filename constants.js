const pathDetails = [
    {
        pathName: "akash-osmosis",
        pathDir: "~/.rly-akash",
        srcName: "akash",
        dstName: "osmosis",
        srcLcd: "https://public-lcd2.akash.vitwit.com",
        dstLcd: "http://143.198.234.89:1317",
        srcChannel: "channel-9",
        dstChannel: "channel-1"
    },
    {
        pathName: "cosmos-osmosis",
        pathDir: "~/.rly-cosmos",
        srcName: "cosmos",
        dstName: "osmosis",
        srcLcd: "http://159.203.104.207:1317",
        dstLcd: "http://143.198.234.89:1317",
        srcChannel: "channel-141",
        dstChannel: "channel-0"
    },
    {
        pathName: "sentinel-osmosis",
        pathDir: "~/.rly-sentinel",
        srcName: "sentinel",
        dstName: "osmosis",
        srcLcd: "http://68.183.119.113:1317",
        dstLcd: "http://143.198.234.89:1317",
        srcChannel: "channel-0",
        dstChannel: "channel-2"
    },
    {
        pathName: "regen-osmosis",
        pathDir: "~/.rly-regen",
        srcName: "regen",
        dstName: "osmosis",
        srcLcd: "http://public-rpc.regen.vitwit.com:1317",
        dstLcd: "http://143.198.234.89:1317",
        srcChannel: "channel-1",
        dstChannel: "channel-8"
    },
    {
        pathName: "iris-osmosis",
        pathDir: "~/.rly-iris",
        srcName: "iris",
        dstName: "osmosis",
        srcLcd: "http://138.68.25.135:1317",
        dstLcd: "http://143.198.234.89:1317",
        srcChannel: "channel-3",
        dstChannel: "channel-6"
    },
    {
        pathName: "core-osmosis",
        pathDir: "~/.rly-core",
        srcName: "core",
        dstName: "osmosis",
        srcLcd: "http://159.65.40.115:1317",
        dstLcd: "http://143.198.234.89:1317",
        srcChannel: "channel-6",
        dstChannel: "channel-4"
    },
    {
        pathName: "crypto-osmosis",
        pathDir: "~/.rly-crypto",
        srcName: "crypto",
        dstName: "osmosis",
        srcLcd: "http://64.227.110.233:1317",
        dstLcd: "http://143.198.234.89:1317",
        srcChannel: "channel-10",
        dstChannel: "channel-5"
    },
    {
        pathName: "iov-osmosis",
        pathDir: "~/.rly-iov",
        srcName: "iov",
        dstName: "osmosis",
        srcLcd: "https://rpc.iov-mainnet-ibc.iov.one",
        dstLcd: "http://143.198.234.89:1317",
        srcChannel: "channel-2",
        dstChannel: "channel-15"
    },
]

// const pathDetails = [
//     {
//         pathName: "demo",
//         pathDir: "~/.relayer",
//         srcName: "ibc-0",
//         dstName: "ibc-1",
//         srcLcd: "http://localhost:1317",
//         dstLcd: "http://localhost:1318",
//         srcChannel: "channel-0",
//         dstChannel: "channel-0"
//     }
// ]

module.exports = {
    pathDetails
}
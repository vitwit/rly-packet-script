var UnrelayedModel = require("./schema.js");

const getStats = (req, res) => {
    let { query } = req
    let filters = query.path ? { pathName: query.path } : {}
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

module.exports = {
    getStats
}
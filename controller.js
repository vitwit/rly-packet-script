var UnrelayedModel = require("./schema.js");

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

module.exports = {
    getStats
}
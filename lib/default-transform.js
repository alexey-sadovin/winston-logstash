var winston3xHooks = require('./winston-3x-hooks');

module.exports = function (level, msg, meta, self) {
    return winston3xHooks.log({
        level: level,
        message: msg,
        node_name: self.node_name,
        meta: meta,
        timestamp: self.timestamp,
        json: true,
        label: self.label
    });
};

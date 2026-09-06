"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const config_1 = require("./config");
const port = (0, config_1.getPort)(process.env.PORT);
app_1.app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on ${port}`);
});

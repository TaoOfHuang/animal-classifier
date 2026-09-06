"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
describe('getPort', () => {
    it('uses default port when env is empty', () => {
        expect((0, config_1.getPort)(undefined)).toBe(3000);
    });
    it('throws on invalid port', () => {
        expect(() => (0, config_1.getPort)('abc')).toThrow('Invalid PORT value: abc');
    });
});

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = void 0;
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const render = (templateName, data) => {
    const filePath = path_1.default.join(__dirname, '../views', `${templateName}.hbs`);
    const templateContent = fs_1.default.readFileSync(filePath, 'utf8');
    const template = handlebars_1.default.compile(templateContent);
    return template(data);
};
exports.render = render;
// const render = (templateName, data = {}) => {
// 	const filePath = path.join(__dirname, 'views', `${templateName}.hbs`);
// 	const templateContent = fs.readFileSync(filePath, 'utf8');
// 	const template = handlebars.compile(templateContent);
// 	return template(data);
// };

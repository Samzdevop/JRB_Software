import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

export const render = (
	templateName: string,
	data: Record<string, any>
): string => {
	const filePath = path.join(__dirname, '../views', `${templateName}.hbs`);
	const templateContent = fs.readFileSync(filePath, 'utf8');
	const template = handlebars.compile(templateContent);
	return template(data);
};

// const render = (templateName, data = {}) => {
// 	const filePath = path.join(__dirname, 'views', `${templateName}.hbs`);
// 	const templateContent = fs.readFileSync(filePath, 'utf8');
// 	const template = handlebars.compile(templateContent);
// 	return template(data);
// };